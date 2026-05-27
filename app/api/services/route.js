import { NextResponse } from 'next/server';
import { getServices, getServicesServer4 } from '@/lib/otpProvider';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const server = searchParams.get('server') || 'server3';

  try {
    if (server === 'server4') {
      // Server4: return all apps/services from RuangOTP (no country needed)
      const data = await getServicesServer4();
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      });
    }

    // Server3: requires negara ID
    const negara = searchParams.get('negara');
    if (!negara) {
      return NextResponse.json({ error: 'negara required' }, { status: 400 });
    }
    const markup = parseFloat(process.env.OTP_PRICE_MARKUP || '1.5');
    const data = await getServices(negara, 'server3');
    if (data.success && data.data) {
      data.data = data.data.map(svc => ({
        ...svc,
        price_original: svc.price,
        price: Math.ceil(svc.price * markup),
        price_format: `Rp${Math.ceil(svc.price * markup).toLocaleString('id-ID')}`,
      }));
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
