import { NextResponse } from 'next/server';
import { getOperators } from '@/lib/rumahotp';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country');
  const provider_id = searchParams.get('provider_id');

  if (!country || !provider_id) {
    return NextResponse.json({ error: 'country and provider_id required' }, { status: 400 });
  }

  try {
    const data = await getOperators(country, provider_id);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
