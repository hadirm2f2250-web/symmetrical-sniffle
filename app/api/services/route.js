import { NextResponse } from 'next/server';
import { getServices } from '@/lib/rumahotp';

export async function GET() {
  try {
    const data = await getServices();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
