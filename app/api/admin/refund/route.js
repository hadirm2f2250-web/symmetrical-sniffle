import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

export async function POST(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
    const supabase = getServiceSupabase();

    // Verifikasi admin
    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { order_id } = await request.json();
    if (!order_id) {
      return NextResponse.json({ error: 'order_id wajib diisi' }, { status: 400 });
    }

    // Ambil data order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_id, user_id, price, status, service, phone_number')
      .eq('order_id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    // Cek order sudah di-refund sebelumnya
    const { data: existingRefund } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', order.user_id)
      .eq('type', 'refund')
      .filter('metadata->>order_id', 'eq', order_id)
      .maybeSingle();

    if (existingRefund) {
      return NextResponse.json({ error: 'Order ini sudah pernah di-refund.' }, { status: 400 });
    }

    // 1. Kembalikan saldo user via atomic RPC
    const { error: rpcErr } = await supabase.rpc('increment_balance', {
      uid: order.user_id,
      amt: order.price,
    });

    if (rpcErr) {
      console.error('increment_balance RPC failed:', rpcErr);
      return NextResponse.json({ error: 'Gagal mengembalikan saldo. ' + rpcErr.message }, { status: 500 });
    }

    // 2. Catat transaksi refund
    await supabase.from('transactions').insert({
      user_id: order.user_id,
      type: 'refund',
      amount: order.price,
      status: 'success',
      metadata: {
        order_id,
        reason: 'admin_manual_refund',
        refunded_by: user.id,
        service: order.service,
        phone_number: order.phone_number,
      },
    });

    // 3. Hapus row order dari DB
    const { error: deleteErr } = await supabase
      .from('orders')
      .delete()
      .eq('order_id', order_id);

    if (deleteErr) {
      // Saldo sudah dikembalikan, tapi gagal hapus — log saja
      console.error('Failed to delete order after refund:', deleteErr);
      return NextResponse.json({
        success: true,
        warning: 'Saldo berhasil dikembalikan, tapi order gagal dihapus. Hapus manual via Supabase.',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Refund berhasil. Rp${Number(order.price).toLocaleString('id-ID')} dikembalikan ke user & order dihapus.`,
    });

  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
