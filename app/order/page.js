'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { useProfile } from '@/lib/useProfile';

// ── Custom Dropdown Field Component ────────────────────────────────
function DropdownField({ label, placeholder, options, value, onChange, loading, error, onRetry, disabled, keyField, labelField }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => String(o[keyField]) === String(value));
  const filtered = options.filter(o => (o[labelField] || '').toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (opt) => {
    onChange(String(opt[keyField]));
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="form-group" ref={ref} style={{ position: 'relative' }}>
      <label className="form-label">{label}</label>

      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled && !error}
        onClick={() => {
          if (error && onRetry) { onRetry(); return; }
          if (!disabled) setOpen(o => !o);
        }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px', background: 'var(--bg-2)',
          border: `1px solid ${error ? 'var(--red)' : open ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)', cursor: disabled && !error ? 'not-allowed' : 'pointer',
          color: selected ? 'var(--text-1)' : 'var(--text-3)',
          fontSize: '0.9rem', fontFamily: 'var(--font)',
          opacity: disabled && !error ? 0.5 : 1,
          transition: 'border-color 0.18s ease',
        }}
      >
        {/* Loading skeleton */}
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spinner" style={{ width: 14, height: 14 }}></span>
            <span style={{ color: 'var(--text-3)' }}>Memuat...</span>
          </span>
        ) : error ? (
          <span style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚠ Gagal memuat — klik untuk coba lagi
          </span>
        ) : (
          <span>{selected ? selected[labelField] : placeholder}</span>
        )}
        <span style={{ color: 'var(--accent)', fontSize: '0.75rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {/* Dropdown panel */}
      {open && !loading && !error && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg-2)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-sm)', marginTop: 4,
          maxHeight: 280, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'dropDown 0.15s ease',
        }}>
          {/* Search */}
          {options.length > 6 && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-2)' }}>
              <input
                autoFocus
                placeholder="🔍 Cari..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '6px 10px',
                  color: 'var(--text-1)', fontSize: '0.85rem', outline: 'none',
                }}
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.85rem' }}>Tidak ditemukan</div>
          ) : (
            filtered.map(opt => (
              <div
                key={opt[keyField]}
                onClick={() => handleSelect(opt)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: '0.875rem',
                  background: String(opt[keyField]) === String(value) ? 'var(--accent-glow)' : 'transparent',
                  color: String(opt[keyField]) === String(value) ? 'var(--accent)' : 'var(--text-1)',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (String(opt[keyField]) !== String(value)) e.currentTarget.style.background = 'var(--bg-3)'; }}
                onMouseLeave={e => { if (String(opt[keyField]) !== String(value)) e.currentTarget.style.background = 'transparent'; }}
              >
                {opt[labelField]}
                {opt._sub && <span style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginLeft: 8 }}>{opt._sub}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function OrderPage() {
  const router = useRouter();
  const { session, profile, ready, refreshProfile } = useProfile();

  // Server state
  const [selectedServer, setSelectedServer] = useState('server3');

  // Helper: cek apakah otp_code benar-benar OTP (bukan placeholder)
  const isRealOtp = (code) => {
    if (!code || code === '-') return false;
    const placeholders = ['menunggu', 'waiting', 'pending'];
    return !placeholders.includes(String(code).trim().toLowerCase());
  };

  // Form state
  const [countries, setCountries] = useState([]);
  const [services, setServices] = useState([]);
  const [operators, setOperators] = useState([]);

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedOperator, setSelectedOperator] = useState(null);

  const [loadingCtry, setLoadingCtry] = useState(false);
  const [loadingSvc, setLoadingSvc] = useState(false);
  const [loadingOp, setLoadingOp] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const [errorCtry, setErrorCtry] = useState(false);
  const [errorSvc, setErrorSvc] = useState(false);
  const [errorOp, setErrorOp] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // Active orders state
  const [activeOrders, setActiveOrders] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const cancellingRef = useRef(new Set()); // Guard for multi-order auto-cancel
  const [now, setNow] = useState(Date.now());

  const token = session?.access_token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── On mount & server change ──────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (!session) { router.push('/login'); return; }

    loadCountries(selectedServer);
    loadActiveOrders();
  }, [ready, session, selectedServer]);

  const handleServerChange = (server) => {
    setSelectedServer(server);
    setSelectedCountry(null); setSelectedService(null); setSelectedOperator(null);
    setCountries([]); setServices([]); setOperators([]);
    setError('');
  };

  // ── Auto-poll active orders every 5s ──────────────────────────────
  // Only poll when there are waiting/expiring orders (not just received ones)
  useEffect(() => {
    const hasPending = activeOrders.some(o => ['waiting', 'expiring'].includes(o.status));
    if (!hasPending) return;
    const interval = setInterval(loadActiveOrders, 5000);
    return () => clearInterval(interval);
  }, [activeOrders]);

  // ── Auto-cancel expired order ───────────────────────────────────────
  // Saat timer habis, langsung kirim cancel ke server.
  // Server akan deteksi bahwa order EXPIRED → skip call JasaOTP → langsung refund.
  // Tidak perlu re-check status karena server sudah ada guard duplikasi.
  const autoCancel = useCallback(async (orderId) => {
    if (cancellingRef.current.has(orderId)) return;
    cancellingRef.current.add(orderId);

    // Langsung hapus dari UI — tidak tampilkan 00:00 spinner lagi
    setActiveOrders(prev => prev.filter(o => o.order_id !== orderId));

    try {
      const res = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ order_id: orderId, status: 'cancel', server: selectedServer }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshProfile();
        showToast('⏱ Order expired — saldo di-refund otomatis');
      }
      await loadActiveOrders();
    } catch {
      // Network error — order tetap hilang dari UI, akan sync saat reload
    } finally {
      cancellingRef.current.delete(orderId);
    }
  }, [selectedServer, token]);


  // ── Auto-update exact time & Auto-cancel expired orders ───────────
  useEffect(() => {
    const timer = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);

      activeOrders.forEach(order => {
        // Only auto-cancel waiting/expiring orders that have NOT received OTP
        // Guard: skip if already in cancellingRef (prevents double-trigger)
        if (['waiting', 'expiring'].includes(order.status) && !isRealOtp(order.otp_code)) {
          const remainingMs = order.expires_at ? new Date(order.expires_at) - currentTime : 0;
          if (remainingMs <= 0 && !cancellingRef.current.has(order.order_id)) {
            // ✅ FIX: add to ref BEFORE calling to prevent multiple triggers in same tick
            cancellingRef.current.add(order.order_id);
            autoCancel(order.order_id);
          }
        }
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeOrders, autoCancel]);

  const loadActiveOrders = async () => {
    try {
      const res = await fetch(`/api/orders/history?page=1`, { headers: authHeaders });
      const json = await res.json();
      if (json.success) {
        const recentOrders = json.data.filter(o => {
          const isPending = ['waiting', 'expiring'].includes(o.status);
          const isRecentSuccess = o.status === 'received' && (Date.now() - new Date(o.created_at).getTime() < 3600000);
          return isPending || isRecentSuccess;
        });

        const updatedOrders = await Promise.all(recentOrders.map(async (o) => {
          // Skip polling for orders currently being auto-cancelled (prevents race condition)
          if (['waiting', 'expiring'].includes(o.status) && !cancellingRef.current.has(o.order_id)) {
            try {
              const statRes = await fetch(`/api/orders/status?order_id=${o.order_id}&server=${selectedServer}`, { headers: authHeaders });
              const statJson = await statRes.json();
              if (statJson.success && statJson.data) {
                return { ...o, ...statJson.data };
              }
            } catch { }
          }
          return o;
        }));

        setActiveOrders(updatedOrders);
      }
    } catch { }
  };

  // ── Load Countries (entry point) ─────────────────────────────────
  const loadCountries = async (server) => {
    const srv = server || selectedServer;
    setLoadingCtry(true); setErrorCtry(false);
    try {
      const res = await fetch(`/api/negara?server=${srv}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.data?.length) throw new Error();
      setCountries(data.data);
    } catch { setErrorCtry(true); }
    setLoadingCtry(false);
  };

  // ── Country → Load Services ──────────────────────────────────────
  const handleCountryChange = async (countryId) => {
    const country = countries.find(c => String(c.id) === String(countryId));
    setSelectedCountry(country || null);
    setSelectedService(null); setSelectedOperator(null);
    setServices([]); setOperators([]);
    setErrorSvc(false); setErrorOp(false);
    if (!country) return;

    // Load services and operators in parallel
    setLoadingSvc(true); setLoadingOp(true);
    try {
      const res = await fetch(`/api/services?negara=${countryId}&server=${selectedServer}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.data?.length) throw new Error();
      setServices(data.data.map(s => ({
        ...s,
        _sub: `${s.price_format} · stok: ${s.stock}`,
      })));
    } catch { setErrorSvc(true); }
    setLoadingSvc(false);

    try {
      const res = await fetch(`/api/operators?negara=${countryId}&server=${selectedServer}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.data?.length) throw new Error();
      setOperators(data.data);
    } catch { setErrorOp(true); }
    setLoadingOp(false);
  };

  const handleServiceChange = (code) => {
    const svc = services.find(s => String(s.service_code) === String(code));
    setSelectedService(svc || null);
  };

  const handleOperatorChange = (id) => {
    const op = operators.find(o => String(o.id) === String(id));
    setSelectedOperator(op || null);
  };

  const retryServices = () => selectedCountry && handleCountryChange(selectedCountry.id);
  const retryOperators = () => selectedCountry && handleCountryChange(selectedCountry.id);

  // Cek maintenance (23:00 - 00:10 WIB)
  const isMaintenance = () => {
    const now = new Date();
    const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const h = wib.getHours(), m = wib.getMinutes();
    return (h === 23) || (h === 0 && m <= 10);
  };

  const handleOrder = async () => {
    if (!selectedCountry || !selectedService || !selectedOperator) {
      setError('Lengkapi semua pilihan terlebih dahulu'); return;
    }
    if (isMaintenance()) {
      setError('Sedang maintenance harian (23:00–00:10 WIB). Coba lagi setelah pukul 00:10 WIB.');
      return;
    }
    setOrdering(true); setError('');
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          negara: selectedCountry.id,
          layanan: selectedService.service_code,
          operator: selectedOperator.id,
          price: selectedService.price,
          service_name: selectedService.service_name,
          country_name: selectedCountry.name,
          server: selectedServer,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = (data.error || '').toLowerCase();
        if (errMsg.includes('stock') || errMsg.includes('stok') || errMsg.includes('no numbers') || errMsg.includes('out of stock') || errMsg.includes('not available')) {
          setError('Stok nomor habis untuk operator ini. Coba pilih operator atau negara lain.');
        } else {
          setError(data.error || 'Gagal membuat order');
        }
        return;
      }

      showToast('🎉 Pembelian nomor berhasil!');
      await loadActiveOrders();
      await refreshProfile();
    } catch (e) {
      setError('Gagal membuat order: ' + e.message);
    } finally {
      setOrdering(false);
    }
  };

  const handleAction = async (orderId, action) => {
    if (action === 'cancel' && cancellingRef.current.has(orderId)) return; // already cancelling
    setActionLoading(orderId);
    try {
      const res = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ order_id: orderId, status: action, server: selectedServer }),
      });
      const data = await res.json();
      if (data.success) {
        if (action === 'cancel') {
          await refreshProfile();
          showToast('✅ Order dibatalkan & saldo di-refund');
        }
        await loadActiveOrders();
      } else {
        showToast('❌ ' + (data.error || data.message || 'Kesalahan server'));
      }
    } catch {
      showToast('❌ Terjadi kesalahan jaringan');
    }
    setActionLoading(null);
  };

  const handleComplete = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ order_id: orderId, status: 'complete', server: selectedServer }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Pesanan selesai!');
        await loadActiveOrders();
      }
    } catch { }
    setActionLoading(null);
  };

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 4 }}></div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.9rem', fontWeight: 500 }}>Memuat Layanan...</div>
      </div>
    );
  }
  if (!session) return null;

  return (
    <>
      <Navbar user={session} profile={profile} />

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999,
          background: 'var(--bg-card)', border: '1px solid var(--accent)', color: 'var(--text-1)',
          padding: '12px 20px', borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)', fontSize: '0.9rem', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          {toast}
        </div>
      )}

      <div className="page-with-sidebar">
        <Sidebar role={profile?.role} />
        <main className="page-content">
          <div className="page-header">
            <h1>Order OTP</h1>
            <p>Pilih negara, layanan, dan operator untuk membeli nomor virtual</p>
          </div>

          <div className="grid-2" style={{ gap: 24, alignItems: 'flex-start' }}>

            {/* ── Left: Order Form ── */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>🛒 Form Order</div>

              {/* Server Picker */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ marginBottom: 8 }}>Server</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ id: 'server3', label: 'Server 3' }, { id: 'server4', label: 'Server 4' }].map(srv => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => handleServerChange(srv.id)}
                      style={{
                        flex: 1, padding: '10px 14px',
                        background: selectedServer === srv.id ? 'var(--accent-glow)' : 'var(--bg-2)',
                        border: `1.5px solid ${selectedServer === srv.id ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        color: selectedServer === srv.id ? 'var(--accent)' : 'var(--text-2)',
                        fontSize: '0.85rem', fontWeight: selectedServer === srv.id ? 600 : 400,
                        fontFamily: 'var(--font)',
                        transition: 'all 0.15s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedServer === srv.id ? 'var(--green)' : 'var(--text-3)', display: 'inline-block' }}></span>
                      {srv.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info notices */}
              <div style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                marginBottom: 16, fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.7,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div>🕐 <strong>Maintenance harian 23:00–00:10 WIB</strong> — transaksi pada jam tersebut akan <strong>GAGAL</strong>.</div>
                <div>⚠ Jika muncul error &quot;Gangguan server provider&quot;, artinya <strong>stok habis</strong> — coba operator/negara lain.</div>
              </div>

              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

              {/* Saldo */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>💰 Saldo kamu</span>
                <strong style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontSize: '1.05rem' }}>
                  Rp{Number(profile?.balance || 0).toLocaleString('id-ID')}
                </strong>
              </div>

              {/* 1. Country Dropdown (Entry Point) */}
              <DropdownField
                label="Negara"
                placeholder="— Pilih negara —"
                options={countries}
                value={selectedCountry?.id || ''}
                onChange={handleCountryChange}
                loading={loadingCtry}
                error={errorCtry}
                onRetry={loadCountries}
                disabled={false}
                keyField="id"
                labelField="name"
              />

              {/* 2. Service Dropdown */}
              <DropdownField
                label="Layanan / Aplikasi"
                placeholder="— Pilih aplikasi —"
                options={services}
                value={selectedService?.service_code || ''}
                onChange={handleServiceChange}
                loading={loadingSvc}
                error={errorSvc}
                onRetry={retryServices}
                disabled={!selectedCountry}
                keyField="service_code"
                labelField="service_name"
              />

              {/* 3. Operator Dropdown */}
              <DropdownField
                label="Operator"
                placeholder="— Pilih operator —"
                options={operators}
                value={selectedOperator?.id || ''}
                onChange={handleOperatorChange}
                loading={loadingOp}
                error={errorOp}
                onRetry={retryOperators}
                disabled={!selectedCountry}
                keyField="id"
                labelField="name"
              />

              {/* Price summary */}
              {selectedService && selectedOperator && (
                <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>Harga per OTP</span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>
                    {selectedService.price_format || `Rp${Number(selectedService.price).toLocaleString('id-ID')}`}
                  </span>
                </div>
              )}

              {/* Insufficient balance warning */}
              {selectedService && (profile?.balance || 0) < selectedService.price && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  Saldo tidak cukup. <a href="/deposit" style={{ color: 'var(--accent)' }}>Top up sekarang →</a>
                </div>
              )}

              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={handleOrder}
                disabled={ordering || !selectedCountry || !selectedService || !selectedOperator || (profile?.balance || 0) < (selectedService?.price || 0)}>
                {ordering
                  ? <><span className="spinner" style={{ width: 16, height: 16 }}></span> Memesan...</>
                  : 'Beli Nomor'}
              </button>
            </div>

            {/* ── Right: Active Order / OTP Monitor ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeOrders.length > 0 ? (
                activeOrders.map(order => {
                  const remainingMs = order.expires_at ? new Date(order.expires_at) - now : 0;
                  const mins = Math.max(0, Math.floor(remainingMs / 60000));
                  const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

                  return (
                    <div key={order.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div className="card-title">📱 Order Aktif</div>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--yellow)', fontSize: '0.8rem' }}>
                          {order.status?.toUpperCase() || 'WAITING'}
                        </span>
                      </div>

                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: 6 }}>
                          {order.service} · {order.country}
                        </div>
                        <div className="otp-phone">{order.phone_number}</div>

                        {isRealOtp(order.otp_code) ? (
                          <>
                            <div className="otp-number">{order.otp_code}</div>
                            <div className="alert alert-success" style={{ marginTop: 12, display: 'inline-block' }}>
                              ✅ OTP Berhasil!
                            </div>
                          </>
                        ) : (
                          <>
                            {remainingMs <= 0 ? (
                              // ✅ FIX: show Expired instead of 00:00 with spinner
                              <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-3)', fontSize: '0.85rem' }}>
                                ⏳ Order expired — sedang diproses...
                              </div>
                            ) : (
                              <>
                                <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-2)', fontSize: '0.85rem' }}>
                                  <span className="spinner" style={{ width: 14, height: 14 }}></span> Menunggu OTP...
                                </div>
                                <div className="timer" style={{ marginTop: 12 }}>
                                  ⏱ {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                                </div>
                                <div style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginTop: 4 }}>Waktu tersisa</div>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {isRealOtp(order.otp_code) ? (
                          <button className="btn btn-primary btn-sm" onClick={() => handleComplete(order.order_id)} disabled={actionLoading === order.order_id}
                            style={{ width: '100%' }}>
                            ✅ Pesanan Selesai
                          </button>
                        ) : (
                          <button className="btn btn-danger btn-sm" onClick={() => handleAction(order.order_id, 'cancel')} disabled={actionLoading === order.order_id}>
                            ✕ Batalkan
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>📱</div>
                  <div style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>
                    Order kamu akan muncul di sini setelah dibeli.<br />
                    OTP akan masuk otomatis dan bisa dipantau real-time.
                  </div>
                </div>
              )}

              {/* Quick Tips */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12, fontSize: '0.9rem' }}>💡 Tips</div>
                {[
                  'Pilih "any" operator untuk peluang sukses terbesar',
                  'OTP biasanya masuk dalam 30 detik – 2 menit',
                  'Batalkan jika OTP tidak masuk dalam 5 menit — saldo refund otomatis',
                  'Coba negara berbeda jika stok habis',
                ].map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: '0.8rem', color: 'var(--text-2)', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}
