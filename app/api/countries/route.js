import { NextResponse } from 'next/server';
import { getCountries } from '@/lib/rumahotp';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const service_id = searchParams.get('service_id');

  if (!service_id) {
    return NextResponse.json({ error: 'service_id required' }, { status: 400 });
  }

  try {
    const markup = parseFloat(process.env.OTP_PRICE_MARKUP || '1.5');
    const data = await getCountries(service_id);

    // Apply price markup to each pricelist entry
    if (data.success && data.data) {
      data.data = data.data.map((country) => ({
        ...country,
        pricelist: country.pricelist.map((p) => ({
          ...p,
          price_original: p.price,
          price: Math.ceil(p.price * markup),
          price_format: `Rp${Math.ceil(p.price * markup).toLocaleString('id-ID')}`,
        })),
      }));
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
