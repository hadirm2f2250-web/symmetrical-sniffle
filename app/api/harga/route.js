import { NextResponse } from 'next/server';
import { getPricesListV3, setRateCache } from '@/lib/otpProvider';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get('service');
  const negara  = searchParams.get('negara');

  if (!service || !negara) {
    return NextResponse.json({ error: 'Parameter service dan negara wajib diisi' }, { status: 400 });
  }

  try {
    // Baca kurs terbaru dari DB sebelum hitung harga
    const supabase = getServiceSupabase();
    const { data: rows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['usd_to_idr', 'otp_price_markup']);
    const map = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
    const usdToIdr = parseFloat(map.usd_to_idr || process.env.USD_TO_IDR || '16000');
    const markup   = parseFloat(map.otp_price_markup || process.env.OTP_PRICE_MARKUP || '1.5');
    setRateCache(usdToIdr, markup);

    const data = await getPricesListV3(service, negara);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
