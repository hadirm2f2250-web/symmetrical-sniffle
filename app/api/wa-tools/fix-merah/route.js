import { NextResponse } from 'next/server';
import dns from 'node:dns';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

const SEND_TO = 'support@support.whatsapp.com';
const COOLDOWN_MINUTES = 5;
const SMTP_TIMEOUT_MS = 12000;

dns.setDefaultResultOrder('ipv4first');

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP Gmail timeout. Coba akun Gmail lain atau cek jaringan server.')), ms)),
  ]);
}

async function sendViaGmail(nodemailer, smtpAccount, mail) {
  const configs = [
    { name: '465 SSL', host: 'smtp.gmail.com', port: 465, secure: true },
    { name: '587 TLS', host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true },
  ];
  const errors = [];

  for (const config of configs) {
    const transporter = nodemailer.createTransport({
      ...config,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
      tls: { servername: 'smtp.gmail.com' },
      auth: { user: smtpAccount.user, pass: smtpAccount.pass },
    });

    try {
      const info = await withTimeout(transporter.sendMail(mail), SMTP_TIMEOUT_MS + 3000);
      transporter.close();
      return info;
    } catch (err) {
      transporter.close();
      errors.push(`${config.name}: ${err.message}`);
    }
  }

  throw new Error(errors.join(' | '));
}

function parseSmtpAccounts(settings) {
  try {
    const accounts = JSON.parse(settings.smtp_gmail_accounts || '[]');
    if (Array.isArray(accounts)) {
      return accounts
        .map(account => ({ user: String(account.user || '').trim(), pass: String(account.pass || '').replace(/\s/g, '') }))
        .filter(account => account.user && account.pass);
    }
  } catch {}

  const gmailUser = String(settings.smtp_gmail_user || '').trim();
  const gmailPass = String(settings.smtp_gmail_pass || '').replace(/\s/g, '');
  return gmailUser && gmailPass ? [{ user: gmailUser, pass: gmailPass }] : [];
}

function isWaitingWhatsAppOrder(order) {
  const statusOk = ['waiting', 'expiring'].includes(order?.status);
  const serviceOk = String(order?.service || '').toLowerCase().includes('whatsapp');
  return statusOk && serviceOk && order?.phone_number;
}

export async function POST(request) {
  try {
    const { user } = await getAuthUser(request).catch(() => { throw new Error('UNAUTHORIZED'); });
    const { order_id } = await request.json();
    if (!order_id) return NextResponse.json({ error: 'Order wajib dipilih.' }, { status: 400 });

    const supabase = getServiceSupabase();
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('order_id, user_id, service, country, phone_number, status')
      .eq('order_id', order_id)
      .eq('user_id', user.id)
      .single();

    if (orderErr || !order) return NextResponse.json({ error: 'Order tidak ditemukan.' }, { status: 404 });
    if (!isWaitingWhatsAppOrder(order)) {
      return NextResponse.json({ error: 'Fix login hanya untuk order WhatsApp yang sedang menunggu OTP.' }, { status: 400 });
    }

    const cooldownSince = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();
    const { data: lastLog, error: lastLogErr } = await supabase
      .from('wa_tool_logs')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', cooldownSince)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastLogErr) throw lastLogErr;
    if (lastLog?.created_at) {
      const nextAt = new Date(new Date(lastLog.created_at).getTime() + COOLDOWN_MINUTES * 60 * 1000);
      const waitSeconds = Math.max(1, Math.ceil((nextAt.getTime() - Date.now()) / 1000));
      return NextResponse.json({ error: `Cooldown aktif. Coba lagi dalam ${Math.ceil(waitSeconds / 60)} menit.`, retry_after: waitSeconds }, { status: 429 });
    }

    const { data: settingsRows, error: settingsErr } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['smtp_gmail_user', 'smtp_gmail_pass', 'smtp_gmail_accounts']);
    if (settingsErr) throw settingsErr;

    const settings = {};
    (settingsRows || []).forEach(row => { settings[row.key] = row.value; });
    const smtpAccounts = parseSmtpAccounts(settings);
    if (smtpAccounts.length === 0) {
      return NextResponse.json({ error: 'SMTP Gmail belum diatur admin.' }, { status: 400 });
    }
    const smtpAccount = smtpAccounts[Math.floor(Math.random() * smtpAccounts.length)];

    const number = String(order.phone_number).replace(/\D/g, '');
    if (!number) return NextResponse.json({ error: 'Nomor order tidak valid.' }, { status: 400 });

    const subject = `Appeal for WhatsApp Account: +${number}`;
    const body = `Hello WhatsApp Support Team,

I am writing to appeal the number:

Phone Number : +${number}

I cannot log in because WhatsApp shows login is not available for this number. Please review and restore login access.
Best regards,
${smtpAccount.user}`;

    const nodemailer = (await import('nodemailer')).default;
    const info = await sendViaGmail(
      nodemailer,
      smtpAccount,
      {
        from: `"WhatsApp Login Appeal" <${smtpAccount.user}>`,
        to: SEND_TO,
        subject,
        text: body,
      }
    );

    await supabase.from('wa_tool_logs').insert({
      user_id: user.id,
      order_id: order.order_id,
      phone_number: `+${number}`,
      action: 'fix_merah',
      status: 'sent',
      message_id: info.messageId,
    });

    return NextResponse.json({ success: true, data: { messageId: info.messageId, number: `+${number}` } });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: err.message || 'Gagal kirim email.' }, { status: 500 });
  }
}
