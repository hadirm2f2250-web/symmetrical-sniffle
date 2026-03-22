import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { getDepositStatus } from '@/lib/rumahotp';

export async function GET(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });

    const { searchParams } = new URL(request.url);
    const deposit_id = searchParams.get('deposit_id');
    if (!deposit_id) return NextResponse.json({ error: 'deposit_id required' }, { status: 400 });

    const supabase = getServiceSupabase();

    // Verify deposit belongs to this user
    const { data: deposit } = await supabase
      .from('deposits').select('amount, user_id, status').eq('deposit_id', deposit_id).single();

    if (!deposit) return NextResponse.json({ error: 'Deposit tidak ditemukan' }, { status: 404 });
    if (deposit.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // If already credited, don't double-credit
    if (deposit.status === 'success') {
      return NextResponse.json({ success: true, data: { status: 'success', id: deposit_id } });
    }

    const data = await getDepositStatus(deposit_id);
    if (!data.success) return NextResponse.json({ error: 'Gagal cek status deposit' }, { status: 500 });

    const status = data.data.status;
    await supabase.from('deposits').update({ status }).eq('deposit_id', deposit_id);

    if (status === 'success') {
      const { data: profile } = await supabase
        .from('profiles').select('balance').eq('id', user.id).single();

      await supabase.from('profiles')
        .update({ balance: profile.balance + deposit.amount }).eq('id', user.id);

      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'deposit',
        amount: deposit.amount,
        status: 'success',
        metadata: { deposit_id, payment_info: data.data },
      });
    }

    return NextResponse.json({ success: true, data: data.data });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
