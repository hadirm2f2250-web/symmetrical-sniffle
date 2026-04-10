import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
    const supabase = getServiceSupabase();

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const statusFilter = searchParams.get('status') || 'all';
    const limit = 30;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('orders')
      .select(`
        id, order_id, service, country, operator, phone_number, otp_code,
        status, price, created_at, expires_at, server, user_id,
        profiles:user_id (username)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Flatten profile username
    const orders = (data || []).map(o => ({
      ...o,
      username: o.profiles?.username || 'Unknown',
      profiles: undefined,
    }));

    return NextResponse.json({ success: true, data: orders, count, page, limit });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
