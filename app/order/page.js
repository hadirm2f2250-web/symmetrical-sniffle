'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { useProfile } from '@/lib/useProfile';

// SweetAlert2 import — 'use client' guarantees browser-only execution, no SSR conflict
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

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

  // Ref to always access the LATEST session token (avoids stale closure in callbacks)
  const sessionRef = useRef(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Helper: cek apakah otp_code benar-benar OTP (bukan placeholder)
  const isRealOtp = (code) => {
    if (!code || code === '-') return false;
    const placeholders = ['menunggu', 'waiting', 'pending'];
    return !placeholders.includes(String(code).trim().toLowerCase());
  };

  // ── SweetAlert2 helpers ──────────────────────────────────────────
  const swalLoading = (title, text = '') => {
    Swal.fire({
      title,
      html: text ? `<span style="color:var(--text-2);font-size:0.875rem">${text}</span>` : '',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
      background: '#ffffff',
      color: '#0f172a',
      customClass: { popup: 'swal-dark-popup' },
    });
  };
  const swalSuccess = (title, text = '') => {
    Swal.fire({
      icon: 'success',
      title,
      html: text ? `<span style="color:var(--text-2);font-size:0.875rem">${text}</span>` : '',
      timer: 3000,
      timerProgressBar: true,
      showConfirmButton: false,
      background: '#ffffff',
      color: '#0f172a',
      customClass: { popup: 'swal-dark-popup' },
    });
  };
  const swalError = (title, text = '') => {
    Swal.fire({
      icon: 'error',
      title,
      html: text ? `<span style="color:var(--text-2);font-size:0.875rem">${text}</span>` : '',
      confirmButtonText: 'Tutup',
      background: '#ffffff',
      color: '#0f172a',
      customClass: { popup: 'swal-dark-popup', confirmButton: 'swal-btn-confirm' },
    });
  };

  const [countries, setCountries] = useState([]);
  const [services, setServices] = useState([]);
  const [operators, setOperators] = useState([]);

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedOperator, setSelectedOperator] = useState(null);

  // Server4 extra state
  const [selectedProvider, setSelectedProvider] = useState(null); // pricelist entry

  const [loadingCtry, setLoadingCtry] = useState(false);
  const [loadingSvc, setLoadingSvc] = useState(false);
  const [loadingOp, setLoadingOp] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const [errorCtry, setErrorCtry] = useState(false);
  const [errorSvc, setErrorSvc] = useState(false);
  const [errorOp, setErrorOp] = useState(false);

  // Active orders state
  const [activeOrders, setActiveOrders] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const cancellingRef = useRef(new Set());
  const [now, setNow] = useState(Date.now());

  const token = session?.access_token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  const getFreshHeaders = () => ({ Authorization: `Bearer ${sessionRef.current?.access_token || token}` });

  // ── On mount: load countries ───────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (!session) { router.push('/login'); return; }
    loadCountries();
    loadActiveOrders();
  }, [ready, session]);

  // ── Auto-poll active orders every 5s ──────────────────────────────
  useEffect(() => {
    const hasPending = activeOrders.some(o => ['waiting', 'expiring'].includes(o.status));
    if (!hasPending) return;
    const interval = setInterval(loadActiveOrders, 5000);
    return () => clearInterval(interval);
  }, [activeOrders]);

  // ── Auto-cancel expired orders ────────────────────────────────────
  const autoCancel = useCallback(async (orderId) => {
    if (cancellingRef.current.has(orderId)) return;
    cancellingRef.current.add(orderId);
    setActiveOrders(prev => prev.filter(o => o.order_id !== orderId));
    try {
      const res = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getFreshHeaders() },
        body: JSON.stringify({ order_id: orderId, status: 'cancel' }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshProfile();
        showToast('⏱ Order expired — saldo di-refund otomatis');
      }
      await loadActiveOrders();
    } catch { }
    finally { cancellingRef.current.delete(orderId); }
  }, []);

  // ── Timer & auto-cancel ticker ────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      activeOrders.forEach(order => {
        if (['waiting', 'expiring'].includes(order.status) && !isRealOtp(order.otp_code)) {
          const remainingMs = order.expires_at ? new Date(order.expires_at) - currentTime : 0;
          if (remainingMs <= 0 && !cancellingRef.current.has(order.order_id)) {
            autoCancel(order.order_id);
          }
        }
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeOrders, autoCancel]);

  const loadActiveOrders = async () => {
    try {
      const res = await fetch(`/api/orders/history?page=1`, { headers: getFreshHeaders() });
      const json = await res.json();
      if (json.success) {
        const recentOrders = json.data.filter(o => {
          const isPending = ['waiting', 'expiring'].includes(o.status);
          const isRecentSuccess = o.status === 'received' && (Date.now() - new Date(o.created_at).getTime() < 3600000);
          return isPending || isRecentSuccess;
        });
        const updatedOrders = await Promise.all(recentOrders.map(async (o) => {
          if (['waiting', 'expiring'].includes(o.status) && !cancellingRef.current.has(o.order_id)) {
            try {
              const statRes = await fetch(`/api/orders/status?order_id=${o.order_id}`, { headers: getFreshHeaders() });
              const statJson = await statRes.json();
              if (statJson.success && statJson.data) return { ...o, ...statJson.data };
            } catch { }
          }
          return o;
        }));
        // Remove orders that have been canceled or expired during polling
        const stillActive = updatedOrders.filter(o =>
          ['waiting', 'expiring'].includes(o.status) ||
          (o.status === 'received' && Date.now() - new Date(o.created_at).getTime() < 3600000)
        );
        setActiveOrders(stillActive);
      }
    } catch { }
  };

  // ── SMS Bower Flow: Negara → Layanan → Operator (always 'any') ────────────────────
  const loadCountries = async () => {
    setLoadingCtry(true); setErrorCtry(false);
    try {
      const res = await fetch('/api/negara');
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.data?.length) throw new Error();
      setCountries(data.data);
    } catch { setErrorCtry(true); }
    setLoadingCtry(false);
  };

  const handleCountryChange = async (countryId) => {
    const country = countries.find(c => String(c.id) === String(countryId));
    setSelectedCountry(country || null);
    setSelectedService(null); setSelectedOperator(null);
    setServices([]); setOperators([]);
    setErrorSvc(false); setErrorOp(false);
    if (!country) return;

    // Load services for this country
    setLoadingSvc(true);
    try {
      const res = await fetch(`/api/services?negara=${countryId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.data?.length) throw new Error();
      setServices(data.data);
    } catch { setErrorSvc(true); }
    setLoadingSvc(false);

    // Load operators (always returns 'any' for SMS Bower)
    setLoadingOp(true);
    try {
      const res = await fetch('/api/operators');
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
      swalError('Pilihan Tidak Lengkap', 'Lengkapi semua pilihan (negara, layanan, operator) terlebih dahulu.');
      return;
    }
    if (isMaintenance()) {
      swalError('Maintenance', 'Sedang maintenance harian (23:00–00:10 WIB). Coba lagi setelah pukul 00:10 WIB.');
      return;
    }
    setOrdering(true);
    swalLoading('Sedang cek stok...', 'Mencari nomor yang tersedia untukmu');
    try {
      const body = {
        negara: selectedCountry?.id,
        layanan: selectedService?.service_code,
        operator: selectedOperator?.id || 'any',
        price: selectedService?.price,
        service_name: selectedService?.service_name,
        country_name: selectedCountry?.name,
        server: 'smsbower',
        // Dari getPricesV3 — lock ke provider termurah agar harga display = harga aktual
        provider_id: selectedService?.cheapest_provider_id || null,
      };

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[order] create failed:', data.error);
        swalError('Stok Habis', 'Stok nomor habis untuk pilihan ini. Coba layanan atau negara lain.');
        return;
      }

      swalSuccess('Pembelian Berhasil! 🎉', `Nomor ${data.data?.phone_number || ''} siap menerima OTP`);
      await loadActiveOrders();
      await refreshProfile();
    } catch (e) {
      console.error('[order] unhandled:', e.message);
      swalError('Terjadi Kesalahan', 'Stok nomor habis untuk pilihan ini. Coba layanan atau negara lain.');
    } finally {
      setOrdering(false);
    }
  };


  const handleAction = async (orderId, action) => {
    if (action === 'cancel' && cancellingRef.current.has(orderId)) return;
    setActionLoading(orderId);
    swalLoading(
      action === 'cancel' ? 'Sedang membatalkan...' : 'Memproses...',
      action === 'cancel' ? 'Mohon tunggu, pesanan sedang dibatalkan' : ''
    );
    try {
      const res = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ order_id: orderId, status: action, server: 'smsbower' }),
      });
      const data = await res.json();
      if (data.success) {
        if (action === 'cancel') {
          await refreshProfile();
          swalSuccess('Pesanan Dibatalkan ✅', 'Saldo kamu sudah dikembalikan penuh.');
        }
        await loadActiveOrders();
      } else {
        swalError('Gagal', data.error || data.message || 'Terjadi kesalahan server');
      }
    } catch {
      swalError('Kesalahan Jaringan', 'Tidak bisa terhubung ke server. Periksa koneksi kamu.');
    }
    setActionLoading(null);
  };

  const handleComplete = async (orderId) => {
    setActionLoading(orderId);
    swalLoading('Menyelesaikan pesanan...', '');
    try {
      const res = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ order_id: orderId, status: 'complete', server: 'smsbower' }),
      });
      const data = await res.json();
      if (data.success) {
        swalSuccess('Pesanan Selesai! ✅', 'Terima kasih telah menggunakan DuniaNokos.');
        await loadActiveOrders();
      } else {
        swalError('Gagal Menyelesaikan', data.error || 'Terjadi kesalahan.');
      }
    } catch {
      swalError('Kesalahan Jaringan', 'Tidak bisa terhubung ke server.');
    }
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

              {/* Server info badge — generic, tidak ekspos nama provider */}
              <div style={{
                background: 'var(--accent-glow)', border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-sm)', padding: '8px 14px',
                marginBottom: 16, fontSize: '0.8rem', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }}></span>
                <strong>Server</strong> — Online
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


              {/* Saldo */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>💰 Saldo kamu</span>
                <strong style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontSize: '1.05rem' }}>
                  Rp{Number(profile?.balance || 0).toLocaleString('id-ID')}
                </strong>
              </div>

              {/* SMS Bower single flow: Negara → Layanan → Operator */}
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
              {selectedService && (profile?.balance || 0) < (selectedService?.price || 0) && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  Saldo tidak cukup. <a href="/deposit" style={{ color: 'var(--accent)' }}>Top up sekarang →</a>
                </div>
              )}

              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={handleOrder}
                disabled={ordering || !selectedCountry || !selectedService || !selectedOperator ||
                  (profile?.balance || 0) < (selectedService?.price || 0)}>
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
                        ) : (() => {
                          // Hitung usia order untuk lockout 2 menit
                          const orderAgeMs = order.created_at ? now - new Date(order.created_at).getTime() : Infinity;
                          const LOCK_MS = 2 * 60 * 1000; // 2 menit
                          const isLocked = orderAgeMs < LOCK_MS;
                          const lockRemainSec = isLocked ? Math.ceil((LOCK_MS - orderAgeMs) / 1000) : 0;
                          return (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => !isLocked && handleAction(order.order_id, 'cancel')}
                              disabled={actionLoading === order.order_id || isLocked}
                              title={isLocked ? `Bisa dibatalkan dalam ${lockRemainSec} detik` : 'Batalkan pesanan'}
                              style={{ opacity: isLocked ? 0.55 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                            >
                              {actionLoading === order.order_id
                                ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Membatalkan...</>
                                : isLocked
                                  ? `⏳ ${lockRemainSec}d lagi`
                                  : '✕ Batalkan'}
                            </button>
                          );
                        })()}
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
