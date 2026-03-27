import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { createOrder } from '@/lib/otpProvider';

export async function POST(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => {
      throw new Error('UNAUTHORIZED');
    });

    const { negara, layanan, operator, price, service_name, country_name, server } = await request.json();
    const selectedServer = server || 'server3';

    if (!negara || !layanan || !operator) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Check user balance
    let { data: profile, error: profileErr } = await supabase
      .from('profiles').select('balance, id').eq('id', user.id).single();

    console.log('[orders/create] user.id:', user.id, '| profile:', profile, '| err:', profileErr?.message);

    if (!profile) {
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

    const orderData = await createOrder(negara, layanan, operator, selectedServer);
    console.log('[JasaOTP createOrder response]', JSON.stringify(orderData));
    if (!orderData.success) {
      let errMsg = orderData.message || 'Terjadi kesalahan pada sistem provider.';
      if (typeof errMsg === 'object') {
        errMsg = 'Gangguan pada server provider, silakan coba beberapa saat lagi.';
      }
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const order = orderData.data;
    const expiresAt = new Date(Date.now() + order.expires_in_minute * 60 * 1000).toISOString();

    // Insert order FIRST — only deduct balance if insert succeeds
    const { data: dbOrder, error: insertErr } = await supabase.from('orders').insert({
      user_id: user.id,
      order_id: order.order_id,
      service: service_name || layanan,
      country: country_name || `Country ${negara}`,
      operator: operator,
      phone_number: order.phone_number,
      status: 'waiting',
      price,
      server: selectedServer,
      expires_at: expiresAt,
    }).select().single();

    if (insertErr) {
      console.error('[orders/create] insert failed:', insertErr.message);
      return NextResponse.json({ error: 'Gagal menyimpan order. Saldo tidak dipotong.' }, { status: 500 });
    }

    // Deduct balance AFTER order insert confirmed
    await supabase.rpc('decrement_balance', { uid: user.id, amt: price }).then(({ error: rpcErr }) => {
      // Fallback to normal update if RPC doesn't exist
      if (rpcErr) {
        return supabase.from('profiles').update({ balance: profile.balance - price }).eq('id', user.id);
      }
    });

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'purchase',
      amount: price,
      status: 'success',
      metadata: { order_id: order.order_id, service: service_name || layanan, server: selectedServer },
    });

    return NextResponse.json({ success: true, data: { ...order, db_id: dbOrder?.id, expires_at: expiresAt } });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
