import { NextResponse } from 'next/server';
import { getServices, getServicesForCountryServer4 } from '@/lib/otpProvider';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const server = searchParams.get('server') || 'server3';

  try {
    if (server === 'server4') {
      // Server4: requires country name to get services with pricelist/provider
      const country = searchParams.get('country');
      if (!country) {
        return NextResponse.json({ error: 'country required for server4' }, { status: 400 });
      }
      const data = await getServicesForCountryServer4(country);
      if (data.success && data.data) {
        const markup = parseFloat(process.env.OTP_PRICE_MARKUP || '1.5');
        data.data = data.data.map(s => ({
          ...s,
          price_original: s.price,
          price: Math.ceil(s.price * markup),
          price_format: `Rp${Math.ceil(s.price * markup).toLocaleString('id-ID')}`,
        }));
      }
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
