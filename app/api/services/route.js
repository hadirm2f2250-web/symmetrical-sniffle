import { NextResponse } from 'next/server';
import { getServices } from '@/lib/otpProvider';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const negara = searchParams.get('negara');
  const server = searchParams.get('server') || 'server3';

  if (!negara) {
    return NextResponse.json({ error: 'negara required' }, { status: 400 });
  }

  try {
    const markup = parseFloat(process.env.OTP_PRICE_MARKUP || '1.5');
    const data = await getServices(negara, server);

    if (data.success && data.data) {
      data.data = data.data.map((svc) => ({
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
