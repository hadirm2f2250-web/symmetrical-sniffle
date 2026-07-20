import { NextResponse } from 'next/server';
import { getOperators } from '@/lib/otpProvider';

export async function GET(request) {
  // SMS Bower does not have a dedicated operators endpoint.
  // getOperators returns a single "any" option.
  try {
    const data = await getOperators(null, 'smsbower');
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
