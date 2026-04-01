import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { cancelOrder } from '@/lib/otpProvider';

export async function POST(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });

    const { order_id, status, server } = await request.json();
    const selectedServer = server || 'server3';

    if (!order_id || !status) {
      return NextResponse.json({ error: 'order_id dan status wajib diisi' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Verify the order belongs to this user
    const { data: order, error: orderErr } = await supabase
      .from('orders').select('price, user_id, status, server, created_at').eq('order_id', order_id).single();

    if (orderErr || !order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    if (order.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // JasaOTP only supports cancel, not resend
    if (status === 'resend') {
      return NextResponse.json({ success: false, error: 'Server ini tidak mendukung permintaan OTP ulang. Silakan batalkan dan order baru.' }, { status: 400 });
    }

    // Mark as completed (user confirms OTP received)
    if (status === 'complete') {
      // GUARD: Only allow completing if order is still in a valid pre-complete state
      if (['canceled', 'completed'].includes(order.status)) {
        return NextResponse.json({ success: false, error: 'Pesanan sudah dibatalkan atau diselesaikan sebelumnya.' }, { status: 400 });
      }
      // Atomic: only update if still in valid state (prevents race with concurrent cancel)
      const { data: completedOrder } = await supabase.from('orders')
        .update({ status: 'completed' })
        .eq('order_id', order_id)
        .in('status', ['received', 'waiting', 'expiring'])
        .select()
        .maybeSingle();
      if (!completedOrder) {
        return NextResponse.json({ success: false, error: 'Pesanan sudah dibatalkan atau diselesaikan sebelumnya.' }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Pesanan selesai' });
    }

    // Prevent cancelling if the order is already completed, received, or canceled
    if (status === 'cancel' && !['waiting', 'expiring'].includes(order.status)) {
      return NextResponse.json({ success: false, error: 'Order ini sudah selesai atau menerima OTP, tidak dapat dibatalkan.' }, { status: 400 });
    }

    // GUARD: JasaOTP requires 2 minutes before cancel is allowed
    if (status === 'cancel') {
      const ageMs = order.created_at ? Date.now() - new Date(order.created_at).getTime() : Infinity;
      if (ageMs < 2 * 60 * 1000) {
        const remainingSec = Math.ceil((2 * 60 * 1000 - ageMs) / 1000);
        return NextResponse.json({ success: false, error: `Pesanan belum bisa dibatalkan. Tunggu ${remainingSec} detik lagi (minimal 2 menit setelah order).` }, { status: 400 });
      }
    }

    // CRITICAL: Use server from DB (where the order was originally created), NOT from frontend state
    const orderServer = order.server || selectedServer;
    const data = await cancelOrder(order_id, orderServer);

    // If the provider already cancelled it (due to timeout or other reasons), treat as success.
    // IMPORTANT: Do NOT match EARLY_CANCEL_DENIED — its message contains 'batal'/'cancel' but
    // JasaOTP has NOT actually cancelled the order yet.
    const isEarlyCancel = !data.success &&
      data.message && data.message.toLowerCase().includes('belum bisa');
    const isAlreadyCanceled = !data.success && !isEarlyCancel &&
      data.message && 
      (data.message.toLowerCase().includes('tidak ditemukan') ||
       data.message.toLowerCase().includes('time out') ||
       (data.message.toLowerCase().includes('batal') && !data.message.toLowerCase().includes('belum')) ||
       (data.message.toLowerCase().includes('cancel') && !data.message.toLowerCase().includes('belum')));

    if (data.success || isAlreadyCanceled) {

      // DOUBLE-CHECK: Ensure no refund transaction already exists for this order
      const { data: existingRefund } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'refund')
        .filter('metadata->>order_id', 'eq', order_id)
        .maybeSingle();

      if (existingRefund) {
        // Refund already processed — just ensure order status is correct
        await supabase.from('orders').update({ status: 'canceled' }).eq('order_id', order_id);
        return NextResponse.json({ success: false, error: 'Refund sudah diproses sebelumnya.' }, { status: 400 });
      }

      // ATOMIC UPDATE: Only update if the order is still waiting/expiring.
      // If a concurrent request already cancelled it, this will safely return no rows.
      const { data: updatedOrder, error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'canceled' })
        .eq('order_id', order_id)
        .in('status', ['waiting', 'expiring'])
        .select()
        .maybeSingle();

      if (updateErr || !updatedOrder) {
        // Handled concurrently by another request
        return NextResponse.json({ success: false, error: 'Pesanan sudah dibatalkan atau sedang diproses.' }, { status: 400 });
      }

      // Atomic refund: increment balance directly — NO fallback to prevent race condition
      const { error: rpcErr } = await supabase.rpc('increment_balance', { uid: user.id, amt: order.price });
      if (rpcErr) {
        // RPC failed — revert the order status and report error (do NOT use read+write fallback)
        await supabase.from('orders').update({ status: 'waiting' }).eq('order_id', order_id);
        console.error('increment_balance RPC failed:', rpcErr);
        return NextResponse.json({ error: 'Gagal mengembalikan saldo. Hubungi admin.' }, { status: 500 });
      }

      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'refund',
        amount: order.price,
        status: 'success',
        metadata: { order_id, reason: 'cancelled or timeout', server: orderServer },
      });

      return NextResponse.json({ success: true, message: 'Pesanan berhasil dibatalkan dan saldo dikembalikan.' });
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
