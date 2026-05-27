import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// Public endpoint — no auth needed, just read deposit_open setting
export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'deposit_open')
      .maybeSingle();

    if (error) throw error;

    // Default: deposit is OPEN if row not found
    const isOpen = !data || data.value === 'true';
    return NextResponse.json({ success: true, data: { deposit_open: isOpen } });
  } catch (err) {
    // On error, default to open so users aren't blocked
    return NextResponse.json({ success: true, data: { deposit_open: true } });
  }
}
