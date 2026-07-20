import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { setRateCache } from '@/lib/otpProvider';

// GET: baca kurs & markup saat ini
export async function GET(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
    const supabase = getServiceSupabase();

    // Cek role admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Baca dari settings table
    const { data: rows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['usd_to_idr', 'otp_price_markup']);

    const map = Object.fromEntries((rows || []).map(r => [r.key, r.value]));

    return NextResponse.json({
      success: true,
      data: {
        usd_to_idr: parseFloat(map.usd_to_idr || process.env.USD_TO_IDR || '16000'),
        otp_price_markup: parseFloat(map.otp_price_markup || process.env.OTP_PRICE_MARKUP || '1.5'),
      },
    });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: update kurs & markup
export async function POST(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
    const supabase = getServiceSupabase();

    // Cek role admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { usd_to_idr, otp_price_markup } = await request.json();

    const usdRate = parseFloat(usd_to_idr);
    const markup  = parseFloat(otp_price_markup);

    if (isNaN(usdRate) || usdRate < 1000 || usdRate > 100000) {
      return NextResponse.json({ error: 'Kurs tidak valid (1000 – 100000)' }, { status: 400 });
    }
    if (isNaN(markup) || markup < 1 || markup > 10) {
      return NextResponse.json({ error: 'Markup tidak valid (1.0 – 10.0)' }, { status: 400 });
    }

    // Upsert ke settings table
    await supabase.from('settings').upsert([
      { key: 'usd_to_idr',       value: String(usdRate), updated_at: new Date().toISOString() },
      { key: 'otp_price_markup',  value: String(markup),  updated_at: new Date().toISOString() },
    ], { onConflict: 'key' });

    // Update in-memory rate cache (langsung berlaku tanpa restart)
    setRateCache(usdRate, markup);

    console.log(`[admin/rates] updated usd_to_idr=${usdRate} markup=${markup} by user=${user.id}`);

    return NextResponse.json({
      success: true,
      message: `Kurs diperbarui: $1 = Rp${usdRate.toLocaleString('id-ID')}, markup ${markup}×`,
    });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[admin/rates] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
