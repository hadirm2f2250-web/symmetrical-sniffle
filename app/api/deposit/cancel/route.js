import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { cancelDeposit } from '@/lib/rumahotp';

export async function POST(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });

    const { deposit_id } = await request.json();
    if (!deposit_id) return NextResponse.json({ error: 'deposit_id required' }, { status: 400 });

    const supabase = getServiceSupabase();

    // Verify ownership
    const { data: deposit } = await supabase
      .from('deposits').select('user_id').eq('deposit_id', deposit_id).single();

    if (!deposit) return NextResponse.json({ error: 'Deposit tidak ditemukan' }, { status: 404 });
    if (deposit.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const data = await cancelDeposit(deposit_id);
    if (data.success) {
      await supabase.from('deposits').update({ status: 'cancelled' }).eq('deposit_id', deposit_id);
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
