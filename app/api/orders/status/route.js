import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { getOrderStatus } from '@/lib/otpProvider';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const order_id = searchParams.get('order_id');
  const server = searchParams.get('server') || 'server3';

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  try {
    // Auth check — prevent unauthenticated access to order status
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });

    const supabase = getServiceSupabase();

    // Verify the order belongs to this user + fetch price for potential refund
    const { data: orderRow } = await supabase
      .from('orders').select('user_id, server, price').eq('order_id', order_id).single();
    if (!orderRow || orderRow.user_id !== user.id) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    // Check current order status FIRST — don't poll for canceled/completed orders
    const { data: currentOrder } = await supabase
      .from('orders').select('status').eq('order_id', order_id).single();

    if (!currentOrder || !['waiting', 'expiring'].includes(currentOrder.status)) {
      // Order already finalized (canceled/completed/received) — skip provider poll
      return NextResponse.json({ success: true, data: currentOrder });
    }

    // CRITICAL: Use server from DB, not from query param
    const orderServer = orderRow.server || server;
    const data = await getOrderStatus(order_id, orderServer);

    if (data.success) {
      if (data.data.status === 'received' && data.data.otp_code && data.data.otp_code !== '-') {
        // OTP masuk — simpan kode dan tandai received
        await supabase.from('orders')
          .update({ otp_code: data.data.otp_code, status: 'received' })
          .eq('order_id', order_id)
          .in('status', ['waiting', 'expiring']);

      } else if (data.data.status === 'canceled') {
        // ── PROVIDER CANCELED → refund saldo (atomic, idempotent) ──────
        // Guard: cek apakah refund sudah pernah diproses untuk order ini
        const { data: existingRefund } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'refund')
          .filter('metadata->>order_id', 'eq', order_id)
          .maybeSingle();

        if (!existingRefund) {
          // Atomic update status — hanya jika masih waiting/expiring
          const { data: updatedOrder } = await supabase
            .from('orders')
            .update({ status: 'canceled', otp_code: null })
            .eq('order_id', order_id)
            .in('status', ['waiting', 'expiring'])
            .select()
            .maybeSingle();

          if (updatedOrder) {
            // Atomic increment saldo via RPC
            const { error: rpcErr } = await supabase.rpc('increment_balance', {
              uid: user.id,
              amt: orderRow.price,
            });

            if (rpcErr) {
              // Rollback status agar tidak ada order canceled tanpa refund
              await supabase.from('orders').update({ status: 'waiting' }).eq('order_id', order_id);
              console.error('[status-poll] increment_balance RPC failed:', rpcErr);
            } else {
              // Catat transaksi refund
              await supabase.from('transactions').insert({
                user_id: user.id,
                type: 'refund',
                amount: orderRow.price,
                status: 'success',
                metadata: {
                  order_id,
                  reason: 'provider_auto_canceled',
                  provider_message: 'Provider canceled during status poll',
                  server: 'smsbower',
                },
              });
              console.log(`[status-poll] REFUND SUCCESS order=${order_id} Rp${orderRow.price} reason=provider_auto_canceled`);
            }
          }
        } else {
          // Refund sudah ada, pastikan status tetap canceled
          await supabase.from('orders')
            .update({ status: 'canceled', otp_code: null })
            .eq('order_id', order_id)
            .in('status', ['waiting', 'expiring']);
          console.log(`[status-poll] order=${order_id} refund already exists, just updating status`);
        }

      } else {
        // Masih menunggu OTP
        await supabase.from('orders')
          .update({ otp_code: null, status: 'waiting' })
          .eq('order_id', order_id)
          .in('status', ['waiting', 'expiring']);
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

