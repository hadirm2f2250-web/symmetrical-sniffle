import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { cancelOrder, doneOrder } from '@/lib/otpProvider';

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
      .from('orders')
      .select('price, user_id, status, server, created_at, expires_at, otp_code')
      .eq('order_id', order_id)
      .single();

    if (orderErr || !order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    if (order.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // SMS Bower: resend not exposed (use cancel + reorder)
    if (status === 'resend') {
      return NextResponse.json({ success: false, error: 'Permintaan OTP ulang tidak didukung. Silakan batalkan dan order baru.' }, { status: 400 });
    }

    // ── Mark as completed (user confirms OTP received) ──────────────────
    if (status === 'complete') {
      if (['canceled', 'completed'].includes(order.status)) {
        return NextResponse.json({ success: false, error: 'Pesanan sudah dibatalkan atau diselesaikan sebelumnya.' }, { status: 400 });
      }
      // Notify SMS Bower that activation is confirmed (status=6)
      try { await doneOrder(order_id); } catch {}
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

    // ── Cancel flow ──────────────────────────────────────────────────────
    if (status === 'cancel') {
      // Cek apakah status 'received' tapi OTP kosong/tanda '-' (OTP gagal diterima)
      const otpIsEmpty = !order.otp_code || order.otp_code === '-' || order.otp_code.trim() === '';
      const isReceivedButEmpty = order.status === 'received' && otpIsEmpty;

      // Jangan bisa cancel kalau sudah selesai/received (dengan OTP valid)/canceled
      if (!['waiting', 'expiring'].includes(order.status) && !isReceivedButEmpty) {
        return NextResponse.json({ success: false, error: 'Order ini sudah selesai atau menerima OTP, tidak dapat dibatalkan.' }, { status: 400 });
      }

      const now = Date.now();
      const isExpired = order.expires_at && new Date(order.expires_at).getTime() <= now;

      // ── JALUR 1: ORDER EXPIRED (waktu habis) ─────────────────────────
      if (isExpired) {
        console.log(`[cancel] order=${order_id} EXPIRED → skip provider API, langsung refund`);
        return await doRefund({ supabase, user, order, order_id, reason: 'expired_timeout' });
      }

      // ── JALUR 2: SMS Bower — setStatus(8) ────────────────────────────
      const data = await cancelOrder(order_id);
      console.log(`[cancel] order=${order_id} SmsBower response=`, JSON.stringify(data));

      // EARLY_CANCEL_DENIED: SMS Bower sends this if < 2 min since order
      const isEarlyCancel = !data.success && data.message &&
        (data.message.toLowerCase().includes('belum bisa') ||
         data.message.toLowerCase().includes('early_cancel') ||
         data.message.toLowerCase().includes('2 menit'));

      if (isEarlyCancel) {
        return NextResponse.json({ success: false, error: data.message || 'Pesanan belum bisa dibatalkan.' }, { status: 400 });
      }

      const isAlreadyCanceled = !data.success && data.message &&
        (data.message.toLowerCase().includes('tidak ditemukan') ||
         data.message.toLowerCase().includes('no_activation') ||
         data.message.toLowerCase().includes('not found') ||
         data.message.toLowerCase().includes('canceled') ||
         data.message.toLowerCase().includes('expired'));

      if (data.success || isAlreadyCanceled) {
        return await doRefund({
          supabase, user, order, order_id,
          reason: isAlreadyCanceled ? 'provider_already_canceled' : 'user_manual_cancel',
          providerMessage: data.message,
        });
      }

      // Jika status 'received' tapi OTP kosong (tidak valid) — tetap refund meski provider sudah mark aktif
      if (isReceivedButEmpty) {
        console.warn(`[cancel] received-but-no-otp order=${order_id}, forcing refund despite provider response: ${data.message}`);
        return await doRefund({
          supabase, user, order, order_id,
          reason: 'received_invalid_otp',
          providerMessage: data.message,
        });
      }

      console.warn(`[cancel] FAILED order=${order_id} provider_message=${data.message}`);
      return NextResponse.json({ success: false, error: data.message || 'Gagal membatalkan pesanan di provider.' });
    }

    return NextResponse.json({ success: false, error: 'Status tidak valid.' }, { status: 400 });

  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[orders/action] unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Helper: lakukan refund ke user ─────────────────────────────────────────
async function doRefund({ supabase, user, order, order_id, reason, providerMessage }) {
  // Guard: cek apakah refund sudah pernah diproses sebelumnya
  const { data: existingRefund } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', user.id)
    .eq('type', 'refund')
    .filter('metadata->>order_id', 'eq', order_id)
    .maybeSingle();

  if (existingRefund) {
    await supabase.from('orders').update({ status: 'canceled' }).eq('order_id', order_id);
    return NextResponse.json({ success: false, error: 'Refund sudah diproses sebelumnya.' }, { status: 400 });
  }

  // Atomic update status — hanya jika masih waiting/expiring/received-tanpa-OTP
  const { data: updatedOrder, error: updateErr } = await supabase
    .from('orders')
    .update({ status: 'canceled' })
    .eq('order_id', order_id)
    .in('status', ['waiting', 'expiring', 'received'])
    .select()
    .maybeSingle();

  if (updateErr || !updatedOrder) {
    return NextResponse.json({ success: false, error: 'Pesanan sudah dibatalkan atau sedang diproses.' }, { status: 400 });
  }

  // Atomic increment saldo via RPC
  const { error: rpcErr } = await supabase.rpc('increment_balance', { uid: user.id, amt: order.price });
  if (rpcErr) {
    // Rollback status agar tidak ada order canceled tanpa refund
    await supabase.from('orders').update({ status: 'waiting' }).eq('order_id', order_id);
    console.error('increment_balance RPC failed:', rpcErr);
    return NextResponse.json({ error: 'Gagal mengembalikan saldo. Hubungi admin.' }, { status: 500 });
  }

  // Catat transaksi refund
  await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'refund',
    amount: order.price,
    status: 'success',
    metadata: {
      order_id,
      reason,
      provider_message: providerMessage || null,
      server: 'smsbower',
    },
  });

  console.log(`[cancel] REFUND SUCCESS order=${order_id} Rp${order.price} reason=${reason}`);
  return NextResponse.json({ success: true, message: 'Pesanan berhasil dibatalkan dan saldo dikembalikan.' });
}
