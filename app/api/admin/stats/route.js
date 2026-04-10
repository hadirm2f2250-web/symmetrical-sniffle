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

    // Jalankan semua query paralel
    const [
      usersRes,
      purchaseRes,
      refundRes,
      completedRes,
      canceledRes,
      ordersPerDayRes,
    ] = await Promise.all([
      // Total users
      supabase.from('profiles').select('id', { count: 'exact', head: true }),

      // Total purchase amount
      supabase.from('transactions')
        .select('amount')
        .eq('type', 'purchase')
        .eq('status', 'success'),

      // Total refund amount
      supabase.from('transactions')
        .select('amount')
        .eq('type', 'refund')
        .eq('status', 'success'),

      // Completed orders count
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'completed'),

      // Canceled orders count
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'canceled'),

      // Orders per day last 7 days
      supabase.from('orders')
        .select('created_at, status, price')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true }),
    ]);

    const totalUsers = usersRes.count || 0;
    const totalPurchase = (purchaseRes.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalRefund = (refundRes.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
    const completedOrders = completedRes.count || 0;
    const canceledOrders = canceledRes.count || 0;

    // Group orders per day
    const dayMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { date: key, count: 0, revenue: 0 };
    }
    for (const o of (ordersPerDayRes.data || [])) {
      const key = o.created_at?.slice(0, 10);
      if (key && dayMap[key]) {
        dayMap[key].count++;
        if (o.status === 'completed') dayMap[key].revenue += (o.price || 0);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total_users: totalUsers,
        total_purchase: totalPurchase,
        total_refund: totalRefund,
        net_revenue: totalPurchase - totalRefund,
        completed_orders: completedOrders,
        canceled_orders: canceledOrders,
        orders_per_day: Object.values(dayMap),
      },
    });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
