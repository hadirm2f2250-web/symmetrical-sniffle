import { NextResponse } from 'next/server';
import { getCountries } from '@/lib/otpProvider';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const server = searchParams.get('server') || 'server3';
  const serviceId = searchParams.get('service_id');

  try {
    const data = await getCountries(server, serviceId);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
