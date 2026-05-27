import { NextResponse } from 'next/server';
import { getCountries } from '@/lib/otpProvider';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const server = searchParams.get('server') || 'server3';

  try {
    const data = await getCountries(server);
    const res = NextResponse.json(data);
    // Cache at Vercel edge: 5 min fresh, 10 min stale-while-revalidate
    res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
