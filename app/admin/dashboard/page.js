'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { useProfile } from '@/lib/useProfile';

function StatCard({ icon, label, value, sub, color, loading }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${color}33`,
      borderRadius: 'var(--radius)',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${color}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {/* Glow orb */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontSize: '1.6rem' }}>{icon}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
      {loading ? (
        <div style={{ height: 32, background: 'var(--bg-2)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
      ) : (
        <div style={{ fontSize: '1.55rem', fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--mono)' }}>{value}</div>
      )}
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ data, maxVal }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
      {data.map((d, i) => {
        const h = maxVal > 0 ? Math.max(4, (d.count / maxVal) * 60) : 4;
        const label = d.date?.slice(5); // MM-DD
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', height: h,
              background: `linear-gradient(180deg, var(--accent) 0%, var(--accent-glow) 100%)`,
              borderRadius: '3px 3px 0 0', opacity: 0.85, transition: 'height 0.3s ease' }} />
            <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', whiteSpace:'nowrap' }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { session, profile, ready } = useProfile();
  const [stats, setStats] = useState(null);
  const [providerBalance, setProviderBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!session) { router.push('/login'); return; }
    if (profile?.role !== 'admin') { router.push('/dashboard'); return; }
    loadAll(session.access_token);
  }, [ready, session, profile]);

  const loadAll = async (token) => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [statsRes, balRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/balance', { headers }),
      ]);
      const sd = await statsRes.json();
      const bd = await balRes.json();
      if (sd.success) setStats(sd.data);
      if (bd.success) setProviderBalance(bd.data);
    } catch {}
    setLoading(false);
  };

  if (!ready || !session) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:16 }}>
        <div className="spinner" style={{ width:36, height:36, borderWidth:4 }} />
        <div style={{ color:'var(--text-3)', fontSize:'0.9rem' }}>Memuat Dashboard Admin...</div>
      </div>
    );
  }

  const maxDay = stats?.orders_per_day ? Math.max(...stats.orders_per_day.map(d => d.count), 1) : 1;

  return (
    <>
      <Navbar user={session} profile={profile} />
      <div className="page-with-sidebar">
        <Sidebar role="admin" />
        <main className="page-content">
          {/* Header */}
          <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
            <div>
              <h1 style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:'1.6rem' }}>📊</span> Dashboard Admin
              </h1>
              <p>Ringkasan performa & statistik bisnis DuniaNokos</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => session && loadAll(session.access_token)}>
              🔄 Refresh
            </button>
          </div>

          {/* Stats Grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:24 }}>
            <StatCard icon="💰" label="Total Penjualan" color="#00c896"
              value={stats ? `Rp${Number(stats.total_purchase).toLocaleString('id-ID')}` : 'Rp0'}
              sub="Semua waktu" loading={loading} />
            <StatCard icon="📈" label="Net Revenue" color="#7c6af7"
              value={stats ? `Rp${Number(stats.net_revenue).toLocaleString('id-ID')}` : 'Rp0'}
              sub="Penjualan − Refund" loading={loading} />
            <StatCard icon="✅" label="Order Selesai" color="#00b4d8"
              value={stats ? stats.completed_orders.toLocaleString() : '0'}
              sub="Status completed" loading={loading} />
            <StatCard icon="👥" label="Total User" color="#f4a261"
              value={stats ? stats.total_users.toLocaleString() : '0'}
              sub="Akun terdaftar" loading={loading} />
            <StatCard icon="↩️" label="Total Refund" color="#e63946"
              value={stats ? `Rp${Number(stats.total_refund).toLocaleString('id-ID')}` : 'Rp0'}
              sub={stats ? `${stats.canceled_orders} dibatalkan` : '0 dibatalkan'} loading={loading} />
          </div>

          {/* Chart + Provider Balance */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
            {/* Mini chart */}
            <div className="card">
              <div className="card-title" style={{ marginBottom:16, fontSize:'0.9rem' }}>📅 Order 7 Hari Terakhir</div>
              {loading ? (
                <div style={{ height:80, background:'var(--bg-2)', borderRadius:8, animation:'pulse 1.5s infinite' }} />
              ) : stats?.orders_per_day?.length > 0 ? (
                <>
                  <MiniBar data={stats.orders_per_day} maxVal={maxDay} />
                  <div style={{ marginTop:12, display:'flex', gap:16, fontSize:'0.78rem', color:'var(--text-3)' }}>
                    <span>Total: <strong style={{ color:'var(--text-1)' }}>{stats.orders_per_day.reduce((s,d)=>s+d.count,0)} order</strong></span>
                  </div>
                </>
              ) : (
                <div style={{ color:'var(--text-3)', fontSize:'0.85rem' }}>Belum ada data</div>
              )}
            </div>

            {/* Provider balance */}
            <div className="card">
              <div className="card-title" style={{ marginBottom:16, fontSize:'0.9rem' }}>⚡ Saldo Provider</div>
              {loading ? (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[0,1].map(i => <div key={i} style={{ height:48, background:'var(--bg-2)', borderRadius:8, animation:'pulse 1.5s infinite' }} />)}
                </div>
              ) : providerBalance ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {['server3','server4'].map(key => {
                    const srv = providerBalance[key];
                    if (!srv) return null;
                    return (
                      <div key={key} style={{
                        display:'flex', justifyContent:'space-between', alignItems:'center',
                        padding:'12px 14px', background:'var(--bg-2)', borderRadius:'var(--radius-sm)',
                        border:'1px solid var(--border)',
                      }}>
                        <div>
                          <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginBottom:2 }}>{srv.email || key}</div>
                          <div style={{ fontSize:'0.8rem', color:'var(--text-2)' }}>{srv.username}</div>
                        </div>
                        <div style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)', fontSize:'1rem' }}>
                          {srv.formated}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color:'var(--text-3)', fontSize:'0.85rem' }}>Gagal memuat saldo provider</div>
              )}
            </div>
          </div>

          {/* Quick nav */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {[
              { href:'/admin/users', icon:'👥', title:'Kelola User', desc:'Lihat daftar user & topup saldo' },
              { href:'/admin/orders', icon:'📋', title:'Kelola Order', desc:'Monitor order & refund manual' },
            ].map(item => (
              <a key={item.href} href={item.href} style={{
                display:'block', textDecoration:'none',
                background:'var(--bg-card)', border:'1px solid var(--border)',
                borderRadius:'var(--radius)', padding:'20px 24px',
                transition:'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform=''; }}
              >
                <div style={{ fontSize:'1.6rem', marginBottom:8 }}>{item.icon}</div>
                <div style={{ fontWeight:600, color:'var(--text-1)', marginBottom:4 }}>{item.title}</div>
                <div style={{ fontSize:'0.8rem', color:'var(--text-3)' }}>{item.desc}</div>
              </a>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
