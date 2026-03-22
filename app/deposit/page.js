'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { useProfile } from '@/lib/useProfile';
import { QRCodeSVG } from 'qrcode.react';
import { generateDynamicQris } from '@/lib/qris';

const PRESETS = [10000, 20000, 50000, 100000, 200000, 500000];
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

  useEffect(() => {
    if (!ready) return;
    if (!session) router.push('/login');
  }, [ready, session]);

  const handleCreate = () => {
    const amt = parseInt(amount);
    if (!amt || amt < 10000) { setError('Minimum deposit Rp10.000'); return; }
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

          {error && <div className="alert alert-error">⚠ {error}</div>}

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
                  <label className="form-label">Nominal Custom (Min Rp10.000)</label>
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
                  onClick={handleCreate} disabled={loading || !amount || parseInt(amount) < 10000}>
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

                <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 800 }}>1</span>
                  <span>Pilih atau masukkan nominal yang ingin didepositkan.</span>
                </div>
                <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 800 }}>2</span>
                  <span>Klik <strong>Buat QRIS</strong> untuk memunculkan kode QRIS Dinamis. Scan kode tersebut di m-Banking atau E-Wallet apa saja.</span>
                </div>
                <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 800 }}>3</span>
                  <span>Pastikan nama merchant yg muncul adalah <strong>YogaxD Store</strong> dengan nominal yang sama persis seperti yang kamu inputkan. Lanjutkan pembayaran.</span>
                </div>
                <div style={{ display: 'flex', gap: 12, padding: '12px 0', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 800 }}>4</span>
                  <span>Setelah pembayaran sukses, klik tombol <strong>Sudah Bayar? Konfirmasi via WA</strong>. Admin akan segera menambahkan saldo ke akunmu setelah mutasi masuk (biasanya 1-2 menit).</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

