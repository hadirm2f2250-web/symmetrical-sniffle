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
      .from('orders').select('price, user_id, status').eq('order_id', order_id).single();

    if (orderErr || !order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    if (order.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // JasaOTP only supports cancel, not resend
    if (status === 'resend') {
      return NextResponse.json({ success: false, error: 'Server ini tidak mendukung permintaan OTP ulang. Silakan batalkan dan order baru.' }, { status: 400 });
    }

    // Mark as completed (user confirms OTP received)
    if (status === 'complete') {
      await supabase.from('orders').update({ status: 'completed' }).eq('order_id', order_id);
      return NextResponse.json({ success: true, message: 'Pesanan selesai' });
    }

    // Prevent cancelling if the order is already completed, received, or canceled
    if (status === 'cancel' && !['waiting', 'expiring'].includes(order.status)) {
      return NextResponse.json({ success: false, error: 'Order ini sudah selesai atau menerima OTP, tidak dapat dibatalkan.' }, { status: 400 });
    }

    const data = await cancelOrder(order_id, selectedServer);

    // If the provider already cancelled it (due to timeout or other reasons), they will return an error string.
    // We should treat this as a success so the user gets refunded locally and the order is cleared.
    const isAlreadyCanceled = !data.success && 
      data.message && 
      (data.message.toLowerCase().includes('batal') || 
       data.message.toLowerCase().includes('cancel') ||
       data.message.toLowerCase().includes('time out') ||
       data.message.toLowerCase().includes('tidak ditemukan'));

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
        metadata: { order_id, reason: 'cancelled or timeout', server: selectedServer },
      });

      return NextResponse.json({ success: true, message: 'Pesanan berhasil dibatalkan dan saldo dikembalikan.' });
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
