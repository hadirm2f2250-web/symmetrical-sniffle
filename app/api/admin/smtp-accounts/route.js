import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

async function requireAdmin(request) {
  const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
  const supabase = getServiceSupabase();
  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!adminProfile || adminProfile.role !== 'admin') throw new Error('FORBIDDEN');
  return supabase;
}

async function getAccounts(supabase) {
  const { data } = await supabase.from('settings').select('value').eq('key', 'smtp_gmail_accounts').maybeSingle();
  try {
    const accounts = JSON.parse(data?.value || '[]');
    return Array.isArray(accounts) ? accounts.filter(account => account?.user && account?.pass) : [];
  } catch {
    return [];
  }
}

export async function GET(request) {
  try {
    const supabase = await requireAdmin(request);
    const accounts = await getAccounts(supabase);
    return NextResponse.json({ success: true, data: { count: accounts.length } });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (err.message === 'FORBIDDEN') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = await requireAdmin(request);
    const { user, pass } = await request.json();
    const account = { user: String(user || '').trim(), pass: String(pass || '').replace(/\s/g, '') };
    if (!account.user || !account.pass) return NextResponse.json({ error: 'Gmail User dan App Password wajib diisi.' }, { status: 400 });

    const accounts = await getAccounts(supabase);
    const nextAccounts = accounts.filter(item => item.user !== account.user).concat(account);
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'smtp_gmail_accounts', value: JSON.stringify(nextAccounts) }, { onConflict: 'key' });
    if (error) throw error;
    return NextResponse.json({ success: true, data: { count: nextAccounts.length } });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (err.message === 'FORBIDDEN') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
