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
      .from('orders').select('user_id').eq('order_id', order_id).single();
    if (!orderRow || orderRow.user_id !== user.id) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const data = await getOrderStatus(order_id, server);

    if (data.success) {
      const updatePayload = { status: data.data.status };

      // Hanya simpan otp_code kalau benar-benar OTP (bukan placeholder)
      if (data.data.status === 'received' && data.data.otp_code && data.data.otp_code !== '-') {
        updatePayload.otp_code = data.data.otp_code;
        updatePayload.status = 'received';
      } else {
        // Kalau masih waiting, reset otp_code yang mungkin salah tersimpan
        updatePayload.otp_code = null;
        updatePayload.status = 'waiting';
      }

      await supabase.from('orders').update(updatePayload).eq('order_id', order_id);
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

