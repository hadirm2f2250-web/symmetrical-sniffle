'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { useProfile } from '@/lib/useProfile';
import { QRCodeSVG } from 'qrcode.react';
import { generateDynamicQris } from '@/lib/qris';

const PRESETS = [5000, 10000, 20000, 50000, 100000, 200000];
const STATIC_QRIS = "00020101021126570011ID.DANA.WWW011893600915396511043402099651104340303UMI51440014ID.CO.QRIS.WWW0215ID10254223729910303UMI5204737253033605802ID5912YogaxD Store6013Kab. Sidoarjo610561256630450B6";
const WA_KIRIM = "6283843173660"; // Nomor WA Admin untuk konfirmasi

export default function DepositPage() {
  const router = useRouter();
  const { session, profile, ready } = useProfile();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrString, setQrString] = useState(null);
  const [depositId, setDepositId] = useState('');
  const [depositOpen, setDepositOpen] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!session) router.push('/login');
  }, [ready, session]);

  useEffect(() => {
    // Cek status deposit terbuka/tutup dari server
    fetch('/api/deposit-status')
      .then(r => r.json())
      .then(d => setDepositOpen(d?.data?.deposit_open !== false))
      .catch(() => setDepositOpen(true))
      .finally(() => setStatusLoading(false));
  }, []);

  const handleCreate = () => {
    const amt = parseInt(amount);
    if (!amt || amt < 5000) { setError('Minimum deposit Rp5.000'); return; }
    if (!depositOpen) { setError('Deposit sedang ditutup sementara oleh admin.'); return; }
    setLoading(true); setError('');
    try {
      const qris = generateDynamicQris(STATIC_QRIS, amt);
      setQrString(qris);
      // Generate a simple unique ID
      setDepositId('DN' + Date.now().toString().slice(-8));
    } catch { 
      setError('Gagal membuat QRIS. Format statis tidak didukung.'); 
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setQrString(null);
    setDepositId('');
  };
  
  const handleConfirmWA = () => {
    const username = profile?.username || 'Tidak diketahui';
    const text = `Halo Admin, saya ingin konfirmasi deposit.\n\n*Detail Deposit:*\n- Deposit ID: *${depositId}*\n- Username: *${username}*\n- Nominal: *Rp${Number(amount).toLocaleString('id-ID')}*\n\nSaya telah mentransfer dana via QRIS DuniaNokos. Mohon segera dicek dan ditambahkan ke saldo saya. Terima kasih.`;
    window.open(`https://wa.me/${WA_KIRIM}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!ready || !session) return null;

  return (
    <>
      <Navbar user={session} profile={profile} />
      <div className="page-with-sidebar">
        <Sidebar role={profile?.role} />
        <main className="page-content">
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Top Up Saldo</h1>
            <p style={{ color: 'var(--text-2)', marginTop: 4 }}>Isi saldo instan via QRIS All Payment.</p>
          </div>

          {/* ── Status Deposit Tertutup ── */}
          {!statusLoading && !depositOpen && (
            <div style={{
              background: 'linear-gradient(135deg, #2d1a1a 0%, #3d1c1c 100%)',
              border: '1px solid #e63946',
              borderRadius: 'var(--radius)',
              padding: '24px 28px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}>
              <div style={{ fontSize: '2.5rem', flexShrink: 0 }}>🔒</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#ff6b6b', marginBottom: 6 }}>
                  Deposit Sedang Ditutup
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Fitur deposit saat ini tidak tersedia. Silakan coba lagi nanti atau hubungi admin untuk informasi lebih lanjut.
                </div>
                <a
                  href={`https://wa.me/${WA_KIRIM}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginTop: 12, fontSize: '0.82rem', color: '#25d366',
                    textDecoration: 'none', fontWeight: 600,
                  }}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Hubungi Admin via WhatsApp
                </a>
              </div>
            </div>
          )}

          {error && <div className="alert alert-error">⚠ {error}</div>}

          {depositOpen && (
            <div className="grid-2" style={{ gap: 24, alignItems: 'flex-start' }}>
              {/* Left: Input */}
              {!qrString && (
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 16 }}>Nominal Deposit</div>

                  <div className="amount-grid">
                    {PRESETS.map(p => (
                      <div key={p}
                        className={`amount-btn ${String(p) === amount ? 'selected' : ''}`}
                        onClick={() => setAmount(String(p))}>
                        Rp{p.toLocaleString('id-ID')}
                      </div>
                    ))}
                  </div>

                  <div className="form-group" style={{ marginTop: 20 }}>
                    <label className="form-label">Nominal Custom (Min Rp5.000)</label>
                    <input type="number" className="form-input" placeholder="Contoh: 15000"
                      value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>

                  <div style={{ marginTop: 24, padding: '16px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: 4 }}>Total Pembayaran</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)' }}>
                      Rp{Number(amount || 0).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 24 }}
                    onClick={handleCreate} disabled={loading || !amount || parseInt(amount) < 5000}>
                    {loading ? <span className="spinner"></span> : 'Buat QRIS'}
                  </button>
                </div>
              )}

              {/* Right: QR Code Display */}
              {qrString && (
                <div className="card">
                  <div className="qr-container" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize:'0.85rem', color:'var(--text-2)', marginBottom:4 }}>Scan QRIS untuk bayar</div>
                    <div style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)', fontSize:'1.4rem', marginBottom: 16 }}>
                      Rp{Number(amount).toLocaleString('id-ID')}
                    </div>
                    
                    <div style={{ background: '#fff', padding: 16, borderRadius: 12, display: 'inline-block', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      <QRCodeSVG value={qrString} size={220} />
                    </div>
                    
                    <div className="alert alert-info" style={{ marginTop: 20, fontSize: '0.85rem', textAlign: 'center' }}>
                      YogaxD Store
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 16 }}>
                      <button className="btn btn-primary btn-full" onClick={handleConfirmWA}>
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 6}}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        Sudah Bayar? Konfirmasi via WA
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={handleCancel}>Batalkan Transaksi</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Info / Instructions */}
              <div>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card-title" style={{ marginBottom: 4 }}>Instruksi Pembayaran via WhatsApp</div>

                  {[
                    'Pilih atau masukkan nominal yang ingin didepositkan.',
                    <span key={2}>Klik <strong>Buat QRIS</strong> untuk memunculkan kode QRIS Dinamis. Scan kode tersebut di m-Banking atau E-Wallet apa saja.</span>,
                    <span key={3}>Pastikan nama merchant yg muncul adalah <strong>YogaxD Store</strong> dengan nominal yang sama persis seperti yang kamu inputkan. Lanjutkan pembayaran.</span>,
                    <span key={4}>Setelah pembayaran sukses, klik tombol <strong>Sudah Bayar? Konfirmasi via WA</strong>. Admin akan segera menambahkan saldo ke akunmu setelah mutasi masuk (biasanya 1-2 menit).</span>,
                  ].map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{i + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
