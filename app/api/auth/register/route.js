import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { email, password, username } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json({ error: 'Email, password, dan username wajib diisi' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const supabaseAdmin = getServiceSupabase();
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'Username sudah terpakai' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // DB trigger `on_auth_user_created` automatically creates the profile row
    return NextResponse.json({ success: true, user: { id: data.user?.id, email: data.user?.email } });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error: ' + err.message }, { status: 500 });
  }
}


