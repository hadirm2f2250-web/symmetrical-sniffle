import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getOrderStatus } from '@/lib/otpProvider';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const order_id = searchParams.get('order_id');
  const server = searchParams.get('server') || 'server3';

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  try {
    const data = await getOrderStatus(order_id, server);

    if (data.success) {
      const supabase = getServiceSupabase();
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
