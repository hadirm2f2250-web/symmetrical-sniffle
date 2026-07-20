import { NextResponse } from 'next/server';
import { getServices } from '@/lib/otpProvider';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const negara = searchParams.get('negara');

  try {
    const markup = parseFloat(process.env.OTP_PRICE_MARKUP || '1.5');
    const data = await getServices(negara, 'smsbower');

    // Apply markup to prices (already applied in getServicesForCountrySmsBower,
    // but keep this for safety in case raw prices slip through)
    if (data.success && data.data) {
      data.data = data.data.map(svc => ({
        ...svc,
        // Only apply markup if price_format not already set
        price_format: svc.price_format || `Rp${Math.ceil((svc.price || 0) * markup).toLocaleString('id-ID')}`,
      }));
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
