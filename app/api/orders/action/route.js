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

    if (data.success) {
      const { data: profile } = await supabase
        .from('profiles').select('balance').eq('id', user.id).single();

      // Refund balance
      await supabase.from('profiles')
        .update({ balance: profile.balance + order.price }).eq('id', user.id);

      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'refund',
        amount: order.price,
        status: 'success',
        metadata: { order_id, reason: 'cancelled', server: selectedServer },
      });

      await supabase.from('orders').update({ status: 'canceled' }).eq('order_id', order_id);
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
