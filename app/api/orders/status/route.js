import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getOrderStatus } from '@/lib/rumahotp';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const order_id = searchParams.get('order_id');

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  try {
    const data = await getOrderStatus(order_id);

    if (data.success) {
      const supabase = getServiceSupabase();
      const updatePayload = { status: data.data.status };
      if (data.data.otp_code && data.data.otp_code !== '-') {
        updatePayload.otp_code = data.data.otp_code;
      }
      await supabase.from('orders').update(updatePayload).eq('order_id', order_id);
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
