import { NextResponse } from 'next/server';
import { getProviderBalance } from '@/lib/rumahotp';

export async function GET() {
  try {
    const data = await getProviderBalance();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
