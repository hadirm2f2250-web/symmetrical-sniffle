import { NextResponse } from 'next/server';
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

    const supabaseAdmin = getServiceSupabase();

    // Cek username duplikat
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'Username sudah terpakai' }, { status: 400 });
    }

    // Cek email duplikat
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailAlreadyExists = existingAuthUsers?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (emailAlreadyExists) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 });
    }

    // Gunakan admin.createUser agar user langsung confirmed (tidak perlu verifikasi email)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // langsung confirmed, tidak perlu klik link email
      user_metadata: { username },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const userId = data.user?.id;

    // Pastikan profile ada — buat manual dengan service role sebagai fallback
    // (trigger DB bisa saja gagal secara diam-diam)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      // Trigger tidak berjalan, buat profile manual
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({ id: userId, username });

      if (profileError) {
        // Rollback: hapus user auth yang sudah dibuat
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: 'Gagal membuat profil: ' + profileError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, user: { id: userId, email: data.user?.email } });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error: ' + err.message }, { status: 500 });
  }
}


