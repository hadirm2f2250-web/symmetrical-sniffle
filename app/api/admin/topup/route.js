import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

export async function POST(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
    const supabase = getServiceSupabase();

    // Verify caller is admin
    const { data: adminProfile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
      
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { user_id, amount, note } = await request.json();

    if (!user_id || !amount || amount <= 0) {
      return NextResponse.json({ error: 'user_id dan amount valid wajib diisi' }, { status: 400 });
    }
    
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('balance, username')
      .eq('id', user_id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const newBalance = profile.balance + amount;

    await supabase.from('profiles').update({ balance: newBalance }).eq('id', user_id);

    await supabase.from('transactions').insert({
      user_id,
      type: 'deposit',
      amount,
      status: 'success',
      metadata: { source: 'admin_topup', note: note || 'Manual topup by admin' },
    });

    return NextResponse.json({
      success: true,
      data: { username: profile.username, previous_balance: profile.balance, new_balance: newBalance, topup_amount: amount },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
