import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

const SMSBOWER_BASE = 'https://smsbower.page/stubs/handler_api.php';
const SMSBOWER_KEY  = process.env.SMSBOWER_API_KEY || 'P37lcf64UAfiAVvTtli1MY4NG3hY1A09';

export async function GET(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
    const supabase = getServiceSupabase();
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || '6'; // default Indonesia
    const service = searchParams.get('service') || 'wa';

    // Ambil settings dari DB
    const { data: rows } = await supabase.from('settings').select('key, value').in('key', ['usd_to_idr', 'otp_price_markup']);
    const map = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
    const usdToIdr = parseFloat(map.usd_to_idr || process.env.USD_TO_IDR || '16000');
    const markup   = parseFloat(map.otp_price_markup || process.env.OTP_PRICE_MARKUP || '1.5');

    // Hit V2 API langsung
    const qs = new URLSearchParams({ api_key: SMSBOWER_KEY, action: 'getPricesV2', country, service });
    const rawRes = await fetch(`${SMSBOWER_BASE}?${qs}`, { cache: 'no-store' });
    const rawJson = await rawRes.json();

    // Proses harga sama persis seperti getServicesForCountrySmsBower
    const countryData = rawJson[String(country)];
    const serviceData = countryData?.[service];

    let minUsdPrice = Infinity;
    let totalStock = 0;
    const tiers = [];
    if (serviceData && typeof serviceData === 'object') {
      for (const [priceStr, count] of Object.entries(serviceData)) {
        const cnt = Number(count) || 0;
        const usdP = parseFloat(priceStr) || 0;
        tiers.push({ priceStr, cnt, usdP, parsedOk: usdP > 0 });
        if (cnt > 0) {
          totalStock += cnt;
          if (usdP < minUsdPrice) minUsdPrice = usdP;
        }
      }
    }

    const computedPrice = minUsdPrice === Infinity ? null : Math.ceil(minUsdPrice * usdToIdr * markup);

    return NextResponse.json({
      debug: true,
      settings: { usdToIdr, markup },
      env: { USD_TO_IDR: process.env.USD_TO_IDR, OTP_PRICE_MARKUP: process.env.OTP_PRICE_MARKUP },
      query: { country, service },
      rawApiKeys: Object.keys(rawJson || {}).slice(0, 5),
      countryDataKeys: Object.keys(countryData || {}).slice(0, 5),
      serviceDataRaw: serviceData,
      tiers,
      computed: {
        minUsdPrice,
        totalStock,
        formula: `Math.ceil(${minUsdPrice} × ${usdToIdr} × ${markup})`,
        result: computedPrice,
        resultFormatted: computedPrice ? `Rp${computedPrice.toLocaleString('id-ID')}` : null,
      },
    });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
