'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { useProfile } from '@/lib/useProfile';

// FAQ Accordion Component
function FAQAccordion({ question, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 0' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', fontWeight: 600, color: open ? 'var(--accent)' : 'var(--text-1)', fontSize: '0.95rem',
          transition: 'color 0.2s'
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, borderRadius: '50%',
            background: open ? 'var(--accent)' : 'var(--bg-3)',
            color: open ? '#000' : 'var(--text-3)',
            fontSize: '0.8rem', fontWeight: 800, transition: 'all 0.2s'
          }}>?</span>
          {question}
        </div>
        <span style={{ color: open ? 'var(--accent)' : 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'all 0.2s', fontSize: '0.8rem' }}>▼</span>
      </div>
      {open && (
        <div style={{ padding: '16px 0 8px 36px', color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { session, profile, ready, refreshProfile } = useProfile();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!session) { router.push('/login'); return; }
    loadOrders(session.access_token);
  }, [ready, session]);

  const loadOrders = async (token) => {
    try {
      const res = await fetch(`/api/orders/history?page=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setOrders(data.data.slice(0, 10)); // Grab more to find active ones
    } catch { }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await loadOrders(session.access_token);
    setTimeout(() => setRefreshing(false), 500);
  };

  const statusBadge = (s) => {
    const map = {
      waiting: ['badge-waiting', 'Menunggu'],
      received: ['badge-info', 'Diterima'],
      completed: ['badge-success', 'Selesai'],
      canceled: ['badge-danger', 'Batal'],
      expiring: ['badge-pending', 'Hampir Habis'],
    };
    const [cls, label] = map[s] || ['badge-info', s];
    return <span className={`badge ${cls}`}>{label}</span>;
  };


  const activeOrders = orders.filter(o => ['waiting', 'received', 'expiring'].includes(o.status));

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 4 }}></div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.9rem', fontWeight: 500 }}>Memuat Workspace...</div>
      </div>
    );
  }
  if (!session) return null;

  return (
    <>
      <Navbar user={session} profile={profile} />
      <div className="page-with-sidebar">
        <Sidebar role={profile?.role} />
        <main className="page-content">
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Halo, {profile?.username || 'User'}</h1>
            <p style={{ color: 'var(--text-2)', marginTop: 4 }}>Selamat datang kembali di DuniaNokos.</p>
          </div>

          {/* Top Banners */}
          <div className="grid-2" style={{ gap: 20, marginBottom: 32, alignItems: 'stretch' }}>
            {/* Balance Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{
                    width: 48, height: 48, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)'
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 12h.01" /><path d="M17 12h.01" /><path d="M7 12h.01" /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: 2 }}>Saldo Kamu</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)', lineHeight: 1 }}>
                      Rp{Number(profile?.balance || 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
                <Link href="/deposit" className="btn btn-primary btn-sm" style={{ padding: '10px 18px', borderRadius: 'var(--radius-sm)' }}>
                  Isi Saldo
                </Link>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--text-3)', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)' }}>
                  <span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }}></span> Online
                </span>
                <span>• Server berjalan baik saat ini</span>
              </div>
            </div>

            {/* Promo Banner */}
            <div style={{
              background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-2) 100%)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '24px 30px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              position: 'relative', overflow: 'hidden', minHeight: 120
            }}>
              <h2 style={{ color: 'var(--text-1)', fontSize: '1.3rem', marginBottom: 6, fontWeight: 700 }}>Beli Nomor OTP</h2>
              <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 20 }}>Akses OTP instan untuk berbagai layanan.</p>
              <Link href="/order" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                Order Sekarang <span style={{ transition: 'transform 0.2s', marginLeft: 4 }}></span>
              </Link>
            </div>
          </div>

          {/* Active Orders */}
          <div className="card" style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="card-title" style={{ fontSize: '1.1rem' }}>Pesanan Aktif</div>
              <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={refreshing} style={{ padding: '6px 12px' }}>
                {refreshing ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : 'Refresh'}
              </button>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}><span className="spinner"></span></div>
            ) : activeOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: '0.9rem', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)' }}>
                Tidak ada pesanan aktif saat ini.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="responsive">
                  <thead>
                    <tr>
                      <th>Layanan</th><th>Nomor</th><th>Harga</th><th>Status</th><th>Kode OTP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrders.map(o => (
                      <tr key={o.id}>
                        <td data-label="Layanan">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%' }}></div>
                            <strong style={{ fontWeight: 600 }}>{o.service}</strong>
                          </div>
                        </td>
                        <td data-label="Nomor" className="mono-cell" style={{ color: 'var(--text-2)' }}>{o.phone_number || 'Menunggu...'}</td>
                        <td data-label="Harga" className="mono-cell">Rp{Number(o.price).toLocaleString('id-ID')}</td>
                        <td data-label="Status">{statusBadge(o.status)}</td>
                        <td data-label="Kode OTP" className="mono-cell" style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: 1 }}>
                          {o.otp_code && o.otp_code !== '-' ? o.otp_code : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid-2" style={{ gap: 24, alignItems: 'flex-start' }}>
            {/* FAQ Area */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 6, fontSize: '1.1rem' }}>Pertanyaan Umum</div>
              <div className="card-subtitle" style={{ marginBottom: 24 }}>Informasi seputar layanan DuniaNokos</div>

              <div style={{ borderTop: '1px solid var(--border)' }}>
                <FAQAccordion question="Informasi Penting Sebelum Order">
                  <p style={{ marginBottom: 10 }}>Selamat datang di DuniaNokos! Mohon luangkan waktu sebentar untuk membaca panduan sebelum melakukan transaksi untuk kenyamanan bersama.</p>
                  <p style={{ marginBottom: 10 }}>Jika layanan ditandai sedang <strong>maintenance</strong>, artinya kami sedang melakukan perbaikan atau pembaruan sistem. Jika pesanan kamu gagal diproses, kemungkinan besar stok nomor dari pusat sedang habis dan harus menunggu restock.</p>
                  <p style={{ fontWeight: 600, color: 'var(--accent)' }}>Semua informasi dan notifikasi akan selalu tayang jelas di dashboard kamu.</p>
                </FAQAccordion>

                <FAQAccordion question="Kenapa OTP belum masuk?">
                  <p style={{ marginBottom: 10 }}>Proses penerimaan SMS/OTP virtual terkadang butuh waktu dan sesekali tidak masuk. Nomor virtual berbeda dengan kartu fisik biasa, dan hal ini dipengaruhi kualitas jaringan server global atau keamanan ketat dari aplikasi yang kamu daftarkan.</p>
                  <p style={{ marginBottom: 10 }}>Jika OTP tidak kunjung datang dalam waktu 3-5 menit, kamu bisa menekan tombol <strong>Batalkan</strong>. Tidak perlu khawatir, <strong>saldo kamu 100% akan kembali</strong> dan kamu bisa mencoba order nomor yang lain.</p>
                  <p>Saran: Untuk aplikasi yang punya keamanan ketat (seperti Telegram/WhatsApp), terkadang mengganti negara atau menggunakan koneksi yang stabil dapat membantu memperbesar peluang sukses.</p>
                </FAQAccordion>

                <FAQAccordion question="Sistem Batal Otomatis (Auto-Cancel)">
                  <p style={{ marginBottom: 10 }}>Lupa membatalkan pesanan padahal nomornya tidak terpakai?</p>
                  <p>Sistem kami cukup pintar untuk menjaga saldomu. Pesanan yang tidak menerima SMS OTP dalam batas waktu (biasanya 15-20 menit) akan dibatalkan secara otomatis, dan saldomu otomatis ter-refund ke akun tanpa potongan sepeser pun.</p>
                </FAQAccordion>

                <FAQAccordion question="Saldo tidak kembali padahal dibatalkan?">
                  <p style={{ marginBottom: 10 }}>Kasus ini sangat jarang terjadi. Namun jika sistem gagal melakukan refund otomatis setelah order gagal/batal, silakan langsung hubungi kontak Bantuan/Admin kami (bisa dilihat di menu bawah).</p>
                  <p style={{ marginBottom: 10 }}>Mohon sertakan ID Pesanan atau email kamu agar tim kami bisa segera mengecek log sistem dan mengembalikan saldomu saat itu juga.</p>
                  <p style={{ color: 'var(--yellow)', fontStyle: 'italic', fontSize: '0.8rem' }}>*Catatan: Refund manual hanya diproses jika data log server membuktikan OTP memang gagal masuk.</p>
                </FAQAccordion>

                <FAQAccordion question="Kebijakan Pengembalian (Refund)">
                  <p style={{ marginBottom: 10 }}>Prinsip keamanan kami simpel: <strong>Kamu hanya bayar kalau OTP masuk.</strong></p>
                  <p style={{ marginBottom: 10 }}>Selama kode OTP belum tampil di layar, kamu bebas melakukan pembatalan untuk refund penuh.</p>
                  <p style={{ color: 'var(--red)', fontStyle: 'italic', fontSize: '0.8rem' }}>*Begitu kode OTP berhasil diterima oleh dashboard kami, transaksi akan ditandai Selesai dan tidak bisa di-refund, karena nomor tersebut sudah sukses digunakan oleh kamu.</p>
                </FAQAccordion>
              </div>
            </div>

            {/* Recent Orders (Completed) */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div className="card-title" style={{ fontSize: '1.1rem' }}>Riwayat Terakhir</div>
                <Link href="/history" className="btn btn-ghost btn-sm" style={{ padding: '6px 12px' }}>Lihat Semua</Link>
              </div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}><span className="spinner"></span></div>
              ) : orders.filter(o => !['waiting', 'expiring'].includes(o.status)).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: '0.9rem', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)' }}>
                  Belum ada riwayat order.
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="responsive">
                    <thead>
                      <tr>
                        <th>Layanan</th><th>Nomor</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.filter(o => !['waiting', 'expiring'].includes(o.status)).slice(0, 5).map(o => (
                        <tr key={o.id}>
                          <td data-label="Layanan"><strong>{o.service}</strong></td>
                          <td data-label="Nomor" className="mono-cell">{o.phone_number || '-'}</td>
                          <td data-label="Status">{statusBadge(o.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
