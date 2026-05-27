import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

// GET /api/admin/settings — return all settings
export async function GET(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
    const supabase = getServiceSupabase();

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;

    // Convert rows to key-value map
    const map = {};
    (data || []).forEach(row => { map[row.key] = row.value; });

    return NextResponse.json({ success: true, data: map });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/admin/settings — update a setting key-value
export async function PATCH(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
    const supabase = getServiceSupabase();

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { key, value } = await request.json();
    if (!key) return NextResponse.json({ error: 'key wajib diisi' }, { status: 400 });

    const { error } = await supabase
      .from('settings')
      .upsert({ key, value: String(value) }, { onConflict: 'key' });

    if (error) throw error;
    return NextResponse.json({ success: true, data: { key, value } });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
