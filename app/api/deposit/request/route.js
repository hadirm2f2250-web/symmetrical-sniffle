import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { createDeposit } from '@/lib/rumahotp';

export async function POST(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });

    const { amount } = await request.json();

    if (!amount || amount < 10000) {
      return NextResponse.json({ error: 'Minimum deposit Rp10.000' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { count } = await supabase
      .from('deposits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending');

    if (count >= 3) {
      return NextResponse.json({ error: 'Maksimal 3 deposit pending. Batalkan deposit sebelumnya.' }, { status: 429 });
    }

    const data = await createDeposit(amount);
    if (!data.success) {
      return NextResponse.json({ error: 'Gagal membuat QRIS deposit' }, { status: 500 });
    }

    const dep = data.data;
    await supabase.from('deposits').insert({
      user_id: user.id,
      deposit_id: dep.id,
      amount: dep.currency.diterima,
      status: 'pending',
      qr_image: dep.qr,
      expires_at: new Date(dep.expired).toISOString(),
    });

    return NextResponse.json({ success: true, data: dep });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
