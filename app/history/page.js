'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { useProfile } from '@/lib/useProfile';

const STATUS_MAP = {
  waiting:   ['badge-waiting', 'Menunggu'],
  received:  ['badge-info',   'Diterima'],
  completed: ['badge-success','Selesai'],
  canceled:  ['badge-danger', 'Batal'],
  expiring:  ['badge-pending','Hampir Habis'],
};

export default function HistoryPage() {
  const router = useRouter();
  const { session, profile, ready } = useProfile();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!session) { router.push('/login'); return; }
    loadOrders(1);
  }, [ready, session]);

  const loadOrders = async (pg) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/history?page=${pg}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (data.success) { setOrders(data.data); setTotal(data.count || 0); }
    } catch {}
    setLoading(false);
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  if (!ready || !session) return null;

  return (
    <>
      <Navbar user={session} profile={profile} />
      <div className="page-with-sidebar">
        <Sidebar role={profile?.role} />
        <main className="page-content">
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Riwayat Order</h1>
            <p style={{ color: 'var(--text-2)', marginTop: 4 }}>Pantau semua transaksi dan pesanan kamu.</p>
          </div>

          <div className="card">
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
            {['all','waiting','received','completed','canceled'].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(f)}>
                {f === 'all' ? 'Semua' : STATUS_MAP[f]?.[1] || f}
              </button>
            ))}
            </div>
          </div>

          <div className="card">
            {loading ? (
              <div className="loading-overlay"><div className="spinner"></div> Memuat...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-3)' }}>
                Tidak ada data
              </div>
            ) : (
              <div className="table-wrap">
                <table className="responsive">
                  <thead>
                    <tr>
                      <th>Order ID</th><th>Aplikasi</th><th>Negara</th><th>Nomor</th><th>OTP</th><th>Status</th><th>Harga</th><th>Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(o => {
                      const [cls, label] = STATUS_MAP[o.status] || ['badge-info', o.status];
                      return (
                        <tr key={o.id}>
                          <td data-label="Order ID" className="mono-cell" style={{ color:'var(--text-3)', fontSize:'0.75rem' }}>{o.order_id}</td>
                          <td data-label="Layanan">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%' }}></div>
                              <strong style={{ fontWeight: 600 }}>{o.service}</strong>
                            </div>
                          </td>
                          <td data-label="Negara">{o.country}</td>
                          <td data-label="Nomor" className="mono-cell">{o.phone_number || '-'}</td>
                          <td data-label="Kode OTP" className="mono-cell" style={{ color:'var(--accent)', fontWeight:700 }}>
                            {o.otp_code && o.otp_code !== '-' ? o.otp_code : '-'}
                          </td>
                          <td data-label="Status"><span className={`badge ${cls}`}>{label}</span></td>
                          <td data-label="Harga" className="mono-cell">Rp{Number(o.price).toLocaleString('id-ID')}</td>
                          <td data-label="Waktu" style={{ color:'var(--text-3)', fontSize:'0.78rem' }}>
                            {new Date(o.created_at).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'center' }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1}
                onClick={() => { const p = page-1; setPage(p); loadOrders(p); }}>← Prev</button>
              <span style={{ lineHeight:'36px', color:'var(--text-2)', fontSize:'0.85rem' }}>
                Hal {page} dari {Math.ceil(total/20)}
              </span>
              <button className="btn btn-ghost btn-sm" disabled={page >= Math.ceil(total/20)}
                onClick={() => { const p = page+1; setPage(p); loadOrders(p); }}>Next →</button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
