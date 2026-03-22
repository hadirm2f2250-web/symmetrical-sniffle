import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { createOrder } from '@/lib/rumahotp';

export async function POST(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => {
      throw new Error('UNAUTHORIZED');
    });

    const { number_id, provider_id, operator_id, price, service, country, operator } = await request.json();

    if (!number_id || !provider_id || !operator_id) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Check user balance — use upsert as fallback if trigger didn't create profile
    let { data: profile, error: profileErr } = await supabase
      .from('profiles').select('balance, id').eq('id', user.id).single();

    console.log('[orders/create] user.id:', user.id, '| profile:', profile, '| err:', profileErr?.message);

    if (!profile) {
      // Auto-create profile (in case DB trigger didn't run during registration)
      const { data: newProfile, error: createErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username: user.email?.split('@')[0] || 'user', balance: 0, role: 'user' }, { onConflict: 'id' })
        .select('balance, id').single();

      console.log('[orders/create] auto-create profile:', newProfile, createErr?.message);
      if (!newProfile) {
        return NextResponse.json({ error: `Profile tidak ditemukan (id: ${user.id})` }, { status: 404 });
      }
      profile = newProfile;
    }

    if (profile.balance < price) {
      return NextResponse.json({ error: 'Saldo tidak cukup. Silakan deposit terlebih dahulu.' }, { status: 402 });
    }

    const orderData = await createOrder(number_id, provider_id, operator_id);
    console.log('[RumahOTP createOrder response]', JSON.stringify(orderData));
    if (!orderData.success) {
      let errMsg = orderData.message || orderData.error || 'Terjadi kesalahan pada sistem provider.';
      if (typeof errMsg === 'object') {
        errMsg = 'Gangguan pada server provider, silakan coba beberapa saat lagi.';
      }
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const order = orderData.data;
    const expiresAt = new Date(Date.now() + order.expires_in_minute * 60 * 1000).toISOString();

    await supabase.from('profiles').update({ balance: profile.balance - price }).eq('id', user.id);

    const { data: dbOrder } = await supabase.from('orders').insert({
      user_id: user.id,
      order_id: order.order_id,
      service: order.service || service,
      country: order.country || country,
      operator: order.operator || operator,
      phone_number: order.phone_number,
      status: 'waiting',
      price,
      expires_at: expiresAt,
    }).select().single();

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'purchase',
      amount: price,
      status: 'success',
      metadata: { order_id: order.order_id, service: order.service },
    });

    return NextResponse.json({ success: true, data: { ...order, db_id: dbOrder?.id, expires_at: expiresAt } });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
