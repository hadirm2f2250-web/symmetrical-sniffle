import { NextResponse } from 'next/server';
import { getOperators } from '@/lib/otpProvider';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const server = searchParams.get('server') || 'server3';

  try {
    if (server === 'server4') {
      // Server4 (RuangOTP): needs country name + provider_id
      const country = searchParams.get('country');
      const provider_id = searchParams.get('provider_id');
      if (!country || !provider_id) {
        return NextResponse.json({ error: 'country and provider_id required for server4' }, { status: 400 });
      }
      const data = await getOperators(null, 'server4', country, provider_id);
      return NextResponse.json(data);
    }

    // Server3 (JasaOTP): needs negara ID
    const negara = searchParams.get('negara');
    if (!negara) return NextResponse.json({ error: 'negara required' }, { status: 400 });
    const data = await getOperators(negara, 'server3');
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
