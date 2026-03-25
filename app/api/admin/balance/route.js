import { NextResponse } from 'next/server';
import { getProviderBalance } from '@/lib/otpProvider';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
    const supabase = getServiceSupabase();
    
    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    // Fetch balance from both servers
    const [s3, s4] = await Promise.all([
      getProviderBalance('server3'),
      getProviderBalance('server4'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        server3: s3.success ? s3.data : null,
        server4: s4.success ? s4.data : null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
