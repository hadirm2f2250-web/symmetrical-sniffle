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
      .from('orders')
      .select('price, user_id, status, server, created_at, expires_at')
      .eq('order_id', order_id)
      .single();

    if (orderErr || !order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    if (order.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // JasaOTP only supports cancel, not resend
    if (status === 'resend') {
      return NextResponse.json({ success: false, error: 'Server ini tidak mendukung permintaan OTP ulang. Silakan batalkan dan order baru.' }, { status: 400 });
    }

    // ── Mark as completed (user confirms OTP received) ──────────────────
    if (status === 'complete') {
      if (['canceled', 'completed'].includes(order.status)) {
        return NextResponse.json({ success: false, error: 'Pesanan sudah dibatalkan atau diselesaikan sebelumnya.' }, { status: 400 });
      }
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
      // Jangan bisa cancel kalau sudah selesai/received/canceled
      if (!['waiting', 'expiring'].includes(order.status)) {
        return NextResponse.json({ success: false, error: 'Order ini sudah selesai atau menerima OTP, tidak dapat dibatalkan.' }, { status: 400 });
      }

      const orderServer = order.server || selectedServer;
      const now = Date.now();
      const isExpired = order.expires_at && new Date(order.expires_at).getTime() <= now;

      // ── JALUR 1: ORDER EXPIRED (waktu habis) ────────────────────────
      // JasaOTP otomatis handle timeout di sisi mereka.
      // Kita cukup refund langsung tanpa perlu call API JasaOTP.
      if (isExpired) {
        console.log(`[cancel] order=${order_id} EXPIRED → skip JasaOTP API, langsung refund`);
        return await doRefund({ supabase, user, order, order_id, orderServer, reason: 'expired_timeout' });
      }

      // ── JALUR 2: CANCEL MANUAL SEBELUM EXPIRED ──────────────────────
      // Harus call JasaOTP API karena mereka belum tau harus cancel.

      // Guard: JasaOTP butuh minimal 2 menit sebelum bisa cancel
      const ageMs = order.created_at ? now - new Date(order.created_at).getTime() : Infinity;
      if (ageMs < 2 * 60 * 1000) {
        const remainingSec = Math.ceil((2 * 60 * 1000 - ageMs) / 1000);
        return NextResponse.json({
          success: false,
          error: `Pesanan belum bisa dibatalkan. Tunggu ${remainingSec} detik lagi (minimal 2 menit setelah order).`,
        }, { status: 400 });
      }

      // Call JasaOTP cancel API
      const data = await cancelOrder(order_id, orderServer);
      console.log(`[cancel] order=${order_id} server=${orderServer} JasaOTP response=`, JSON.stringify(data));

      // Jika JasaOTP reject karena timing (belum 2 menit versi mereka) — kembalikan error
      const isEarlyCancel = !data.success && data.message &&
        (data.message.toLowerCase().includes('belum bisa') ||
         data.message.toLowerCase().includes('early_cancel') ||
         data.message.toLowerCase().includes('2 menit'));

      if (isEarlyCancel) {
        return NextResponse.json({ success: false, error: data.message || 'Pesanan belum bisa dibatalkan.' }, { status: 400 });
      }

      // Kalau JasaOTP sukses cancel ATAU bilang order tidak ditemukan/timeout (sudah expired di sisi mereka)
      const isAlreadyCanceled = !data.success && data.message &&
        (data.message.toLowerCase().includes('tidak ditemukan') ||
         data.message.toLowerCase().includes('not found') ||
         data.message.toLowerCase().includes('time out') ||
         data.message.toLowerCase().includes('timeout') ||
         data.message.toLowerCase().includes('expired'));

      if (data.success || isAlreadyCanceled) {
        return await doRefund({
          supabase, user, order, order_id, orderServer,
          reason: isAlreadyCanceled ? 'provider_already_canceled' : 'user_manual_cancel',
          providerMessage: data.message,
        });
      }

      // JasaOTP tolak cancel dengan alasan lain — kembalikan error ke user
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
async function doRefund({ supabase, user, order, order_id, orderServer, reason, providerMessage }) {
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

  // Atomic update status — hanya jika masih waiting/expiring
  const { data: updatedOrder, error: updateErr } = await supabase
    .from('orders')
    .update({ status: 'canceled' })
    .eq('order_id', order_id)
    .in('status', ['waiting', 'expiring'])
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
      server: orderServer,
    },
  });

  console.log(`[cancel] REFUND SUCCESS order=${order_id} Rp${order.price} reason=${reason}`);
  return NextResponse.json({ success: true, message: 'Pesanan berhasil dibatalkan dan saldo dikembalikan.' });
}
