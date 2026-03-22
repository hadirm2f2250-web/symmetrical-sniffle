'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [providerBalance, setProviderBalance] = useState(null);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [topupModal, setTopupModal] = useState(null); // {user_id, username}
  const [topupAmount, setTopupAmount] = useState('');
  const [topupNote, setTopupNote] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    const s = localStorage.getItem('dn_session');
    if (!s) { router.push('/login'); return; }
    const parsed = JSON.parse(s);
    if (parsed.profile?.role !== 'admin') { router.push('/dashboard'); return; }
    setSession(parsed);
    loadData(parsed.access_token);
  }, []);

  const loadData = async (token) => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [balRes, usersRes] = await Promise.all([
        fetch('/api/admin/balance', { headers }),
        fetch('/api/admin/users', { headers }),
      ]);
      const balData = await balRes.json();
      const usersData = await usersRes.json();
      if (balData.success) setProviderBalance(balData.data);
      if (usersData.success) setUsers(usersData.data);
    } catch {}
    setLoading(false);
  };

  const handleTopup = async () => {
    if (!topupAmount || parseInt(topupAmount) <= 0) { setMsg({ type:'error', text:'Masukkan nominal yang valid' }); return; }
    setTopupLoading(true);
    try {
      const res = await fetch('/api/admin/topup', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ user_id: topupModal.user_id, amount: parseInt(topupAmount), note: topupNote }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type:'success', text:`✅ Berhasil topup Rp${parseInt(topupAmount).toLocaleString('id-ID')} ke ${topupModal.username}` });
        setTopupModal(null);
        setTopupAmount('');
        setTopupNote('');
        if (session) loadData(session.access_token);
      } else {
        setMsg({ type:'error', text: data.error });
      }
    } catch { setMsg({ type:'error', text:'Gagal topup' }); }
    setTopupLoading(false);
  };

  if (!session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 4 }}></div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.9rem', fontWeight: 500 }}>Memuat Admin Panel...</div>
      </div>
    );
  }

  return (
    <>
      <Navbar user={session} profile={session.profile} />
      <div className="page-with-sidebar">
        <Sidebar role="admin" />
        <main className="page-content">
          <div className="page-header">
            <h1>⚙️ Admin Panel</h1>
            <p>Kelola provider balance, user, dan deposit</p>
          </div>

          {msg.text && (
            <div className={`alert ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}
              style={{ cursor:'pointer' }} onClick={() => setMsg({ type:'', text:'' })}>
              {msg.text}
            </div>
          )}

          {/* Provider Balance */}
          {providerBalance && (
            <div className="admin-provider-card">
              <div>
                <div style={{ fontSize:'0.8rem', color:'var(--text-2)', marginBottom:4 }}>💰 Saldo Provider API</div>
                <div className="provider-balance">{providerBalance.formated}</div>
                <div style={{ fontSize:'0.8rem', color:'var(--text-3)', marginTop:4 }}>
                  {providerBalance.username} · {providerBalance.email}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={loadData} style={{ marginLeft:'auto' }}>
                🔄 Refresh
              </button>
            </div>
          )}

          {/* Users Table */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap: 12 }}>
              <div className="card-title">👥 Daftar User ({users.length})</div>
              <input 
                type="text" 
                className="form-input" 
                style={{ width: '100%', maxWidth: 300 }} 
                placeholder="Cari username..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            {loading ? (
              <div className="loading-overlay"><div className="spinner"></div> Memuat...</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pengguna</th><th>Role</th><th>Saldo</th><th>Bergabung</th><th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => 
                      (u.username || '').toLowerCase().includes((searchQuery || '').toLowerCase())
                    ).map(u => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.username}</strong>
                        </td>
                        <td>
                          <span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-waiting'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="mono-cell" style={{ color:'var(--accent)' }}>
                          Rp{Number(u.balance).toLocaleString('id-ID')}
                        </td>
                        <td style={{ color:'var(--text-3)', fontSize:'0.78rem' }}>
                          {new Date(u.created_at).toLocaleDateString('id-ID')}
                        </td>
                        <td>
                          <button className="btn btn-primary btn-sm"
                            onClick={() => setTopupModal({ user_id: u.id, username: u.username })}>
                            ＋ Topup
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Topup Modal */}
          {topupModal && (
            <div style={{
              position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
              display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
            }}>
              <div className="card" style={{ width:380, background:'var(--bg-1)' }}>
                <div className="card-title" style={{ marginBottom:20 }}>
                  ＋ Topup Saldo — {topupModal.username}
                </div>
                <div className="form-group">
                  <label className="form-label">Nominal (Rp)</label>
                  <input className="form-input" type="number" placeholder="contoh: 50000"
                    value={topupAmount} onChange={e => setTopupAmount(e.target.value)} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Catatan (opsional)</label>
                  <input className="form-input" type="text" placeholder="Transfer BCA, dll"
                    value={topupNote} onChange={e => setTopupNote(e.target.value)} />
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-primary btn-full" onClick={handleTopup} disabled={topupLoading}>
                    {topupLoading ? <><span className="spinner" style={{width:14,height:14}}></span> Proses...</> : 'Topup'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setTopupModal(null); setTopupAmount(''); }}>
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
