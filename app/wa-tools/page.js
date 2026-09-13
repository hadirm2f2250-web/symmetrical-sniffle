'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { useProfile } from '@/lib/useProfile';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

export default function WaToolsPage() {
  const router = useRouter();
  const { session, profile, ready } = useProfile();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!session) { router.push('/login'); return; }
    // WA Tools sedang tidak tersedia — redirect ke dashboard
    router.replace('/dashboard');
  }, [ready, session]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders/history?page=1', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        const waOrders = (data.data || []).filter(order =>
          ['waiting', 'expiring'].includes(order.status) &&
          String(order.service || '').toLowerCase().includes('whatsapp') &&
          order.phone_number
        );
        setOrders(waOrders);
        setSelectedOrder(waOrders[0]?.order_id || '');
      }
    } catch {}
    setLoading(false);
  };

  const handleSend = async () => {
    if (!selectedOrder || sending) return;
    setSending(true);
    Swal.fire({
      title: 'Mengirim appeal...',
      html: '<span style="color:#475569;font-size:0.875rem">Mohon tunggu, email sedang dikirim.</span>',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: '#ffffff',
      color: '#0f172a',
      didOpen: () => Swal.showLoading(),
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch('/api/wa-tools/fix-merah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ order_id: selectedOrder }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Appeal terkirim',
          html: `<span style="color:#475569;font-size:0.875rem">Tunggu 1-2 menit, lalu relog WhatsApp dan masukkan nomor <b>${data.data.number}</b> lagi.</span>`,
          confirmButtonText: 'Mengerti',
          background: '#ffffff',
          color: '#0f172a',
        });
      } else {
        Swal.fire({
          icon: res.status === 429 ? 'warning' : 'error',
          title: res.status === 429 ? 'Cooldown aktif' : 'Gagal kirim appeal',
          text: data.error || 'Gagal kirim email appeal.',
          confirmButtonText: 'Tutup',
          background: '#ffffff',
          color: '#0f172a',
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: err.name === 'AbortError' ? 'Timeout SMTP' : 'Kesalahan jaringan',
        text: err.name === 'AbortError' ? 'Server terlalu lama kirim email. Coba akun Gmail lain atau cek koneksi SMTP server.' : 'Tidak bisa terhubung ke server.',
        confirmButtonText: 'Tutup',
        background: '#ffffff',
        color: '#0f172a',
      });
    }
    clearTimeout(timeout);
    setSending(false);
  };

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 4 }}></div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.9rem', fontWeight: 500 }}>Memuat WA Tools...</div>
      </div>
    );
  }
  if (!session) return null;

  const selected = orders.find(order => order.order_id === selectedOrder);

  return (
    <>
      <Navbar user={session} profile={profile} />
      <div className="page-with-sidebar">
        <Sidebar role={profile?.role} />
        <main className="page-content">
          <div className="page-header">
            <h1>WA Tools</h1>
            <p>Fix login tidak tersedia untuk nomor WhatsApp dari order aktif.</p>
          </div>

          <div className="grid-2" style={{ gap: 24, alignItems: 'flex-start' }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 18 }}>🛠 Fix Login Tidak Tersedia</div>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16, fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.7 }}>
                Pilih nomor WhatsApp dari order yang masih menunggu OTP. Nomor luar tidak bisa dipakai.
              </div>

              <label className="form-label">Nomor WhatsApp login tidak tersedia</label>
              <select
                className="form-input"
                value={selectedOrder}
                onChange={e => setSelectedOrder(e.target.value)}
                disabled={loading || orders.length === 0}
                style={{ marginBottom: 16 }}
              >
                {orders.length === 0 ? (
                  <option value="">Tidak ada order WhatsApp menunggu OTP</option>
                ) : orders.map(order => (
                  <option key={order.order_id} value={order.order_id}>
                    {order.phone_number} - {order.country} - {order.status}
                  </option>
                ))}
              </select>

              {selected && (
                <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 6 }}>Preview</div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{selected.phone_number}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{selected.service} · {selected.country}</div>
                </div>
              )}

              <button className="btn btn-primary btn-full btn-lg" onClick={handleSend} disabled={sending || !selectedOrder}>
                {sending ? <><span className="spinner" style={{ width: 16, height: 16 }}></span> Mengirim...</> : 'Kirim Appeal Fix Login'}
              </button>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>ℹ️ Catatan</div>
              {[
                'Tools ini khusus layanan WhatsApp.',
                'Nomor wajib berasal dari order aktif yang sedang Menunggu OTP.',
                'Cooldown 5 menit per akun untuk mencegah spam email.',
                'Setelah terkirim, tunggu 1-2 menit lalu relog WhatsApp dan masukkan nomor lagi.',
                'SMTP Gmail diatur oleh admin dari Dashboard Admin.',
              ].map((tip, index) => (
                <div key={tip} style={{ display: 'flex', gap: 10, padding: '8px 0', fontSize: '0.84rem', color: 'var(--text-2)', borderBottom: index < 4 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
