'use client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="hero">
          <div className="hero-badge">Sistem Layanan OTP Cepat & Otomatis</div>
          <h1>
            Nomor OTP Virtual<br />
            <span className="highlight">Cepat & Terjangkau</span>
          </h1>
          <p>
            Dapatkan nomor virtual dari 100+ negara untuk verifikasi WhatsApp, Telegram,
            Instagram, dan 200+ aplikasi lainnya. Tanpa SIM card fisik.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="btn btn-primary btn-lg">
              Mulai Sekarang
            </Link>
            <Link href="/login" className="btn btn-ghost btn-lg">
              Sudah Punya Akun
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="features">
          <div className="container">
            <div className="grid-3">
              <div className="feature-card">
                <div className="feature-icon">🌍</div>
                <div className="feature-title">100+ Negara</div>
                <div className="feature-desc">
                  Akses nomor dari Indonesia, China, Rusia, Amerika, dan puluhan negara lainnya
                  dengan harga kompetitif.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon"></div>
                <div className="feature-title">OTP Instan</div>
                <div className="feature-desc">
                  SMS OTP biasanya tiba dalam hitungan detik. Auto-refresh status order
                  setiap 5 detik.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💳</div>
                <div className="feature-title">Deposit QRIS</div>
                <div className="feature-desc">
                  Top up saldo menggunakan QRIS — bisa bayar pakai GoPay, OVO, Dana, QRIS
                  bank apapun.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🔒</div>
                <div className="feature-title">Aman & Terpercaya</div>
                <div className="feature-desc">
                  Saldo dikurangi hanya setelah order berhasil dibuat. Cancel otomatis
                  refund saldo penuh.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📱</div>
                <div className="feature-title">200+ Aplikasi</div>
                <div className="feature-desc">
                  WhatsApp, Telegram, Instagram, TikTok, Facebook, Google, dan ratusan
                  layanan lainnya.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🔄</div>
                <div className="feature-title">Refund Otomatis</div>
                <div className="feature-desc">
                  Jika OTP tidak masuk atau nomor tidak bisa dipakai, batalkan order dan
                  saldo kembali instan.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '80px 0', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <div className="container">
            <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>Siap Mulai?</h2>
            <p style={{ color: 'var(--text-2)', marginBottom: 28 }}>
              Daftar gratis, deposit saldo, dan langsung order OTP dalam 2 menit.
            </p>
            <Link href="/register" className="btn btn-primary btn-lg">
              Daftar Sekarang - Gratis
            </Link>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
        © 2026 DuniaNokos · All Rights Reserved
      </footer>
    </>
  );
}
