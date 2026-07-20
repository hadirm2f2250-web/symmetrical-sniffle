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

    // Verify the order belongs to this user
    const { data: orderRow } = await supabase
      .from('orders').select('user_id, server').eq('order_id', order_id).single();
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
      let updatePayload;

      if (data.data.status === 'received' && data.data.otp_code && data.data.otp_code !== '-') {
        // OTP masuk — simpan kode dan tandai received
        updatePayload = { otp_code: data.data.otp_code, status: 'received' };
      } else if (data.data.status === 'canceled') {
        // Provider membatalkan (timeout/no stock) — tandai canceled di DB
        updatePayload = { status: 'canceled', otp_code: null };
      } else {
        // Masih menunggu OTP
        updatePayload = { otp_code: null, status: 'waiting' };
      }

      // CRITICAL: Only update if order is STILL waiting/expiring (not canceled by another request)
      await supabase.from('orders')
        .update(updatePayload)
        .eq('order_id', order_id)
        .in('status', ['waiting', 'expiring']);
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

