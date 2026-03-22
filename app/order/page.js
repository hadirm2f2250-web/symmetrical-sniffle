'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { useProfile } from '@/lib/useProfile';

// Remove ACTIVE_KEY as we now fetch active orders from API
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

  // Form state — add error states per dropdown
  const [services, setServices] = useState([]);
  const [countries, setCountries] = useState([]);
  const [operators, setOperators] = useState([]);

  const [selectedService, setSelectedService] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedOperator, setSelectedOperator] = useState(null);

  const [loadingSvc, setLoadingSvc] = useState(false);
  const [loadingCtry, setLoadingCtry] = useState(false);
  const [loadingOp, setLoadingOp] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const [errorSvc, setErrorSvc] = useState(false);
  const [errorCtry, setErrorCtry] = useState(false);
  const [errorOp, setErrorOp] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // Active orders state
  const [activeOrders, setActiveOrders] = useState([]);
  const [actionLoading, setActionLoading] = useState(null); // stores order_id currently loading Action

  const token = session?.access_token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── On mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (!session) { router.push('/login'); return; }

    loadServices();
    loadActiveOrders();
  }, [ready, session]);

  // ── Auto-poll active orders every 5s ──────────────────────────────
  useEffect(() => {
    if (activeOrders.length === 0) return;
    const interval = setInterval(loadActiveOrders, 5000);
    return () => clearInterval(interval);
  }, [activeOrders]);

  const loadActiveOrders = async () => {
    try {
      const res = await fetch(`/api/orders/history?page=1`, { headers: authHeaders });
      const json = await res.json();
      if (json.success) {
        // Fetch DB orders that are waiting/expiring OR recently received/completed in the last hour
        const recentOrders = json.data.filter(o => {
          const isPending = ['waiting', 'expiring'].includes(o.status);
          const isRecentSuccess = ['received', 'completed'].includes(o.status) && (Date.now() - new Date(o.created_at).getTime() < 3600000);
          return isPending || isRecentSuccess;
        });

        // Sync with RumahOTP for pending orders
        const updatedOrders = await Promise.all(recentOrders.map(async (o) => {
          if (['waiting', 'expiring'].includes(o.status)) {
            try {
              const statRes = await fetch(`/api/orders/status?order_id=${o.order_id}`);
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

  const loadServices = async () => {
    setLoadingSvc(true); setErrorSvc(false);
    try {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.data?.length) throw new Error();
      setServices(data.data);
    } catch { setErrorSvc(true); }
    setLoadingSvc(false);
  };

  const handleServiceChange = async (code) => {
    setSelectedService(code);
    setSelectedCountry(null); setSelectedProvider(null);
    setSelectedOperator(null); setCountries([]); setOperators([]);
    setErrorCtry(false); setErrorOp(false);
    if (!code) return;
    setLoadingCtry(true);
    try {
      const res = await fetch(`/api/countries?service_id=${code}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.data?.length) throw new Error();
      // Attach _sub for display
      setCountries(data.data.map(c => ({ ...c, _sub: `${c.pricelist[0]?.price_format || ''} · stok: ${c.stock_total}` })));
    } catch { setErrorCtry(true); }
    setLoadingCtry(false);
  };

  const handleCountryChange = async (numberId) => {
    const country = countries.find(c => String(c.number_id) === String(numberId));
    setSelectedCountry(country || null);
    setSelectedProvider(country?.pricelist[0] || null);
    setSelectedOperator(null); setOperators([]); setErrorOp(false);
    if (!country) return;
    setLoadingOp(true);
    try {
      const provider = country.pricelist[0];
      const res = await fetch(`/api/operators?country=${encodeURIComponent(country.name)}&provider_id=${provider.provider_id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.data?.length) throw new Error();
      setOperators(data.data);
    } catch { setErrorOp(true); }
    setLoadingOp(false);
  };

  const retryCountry = () => selectedService && handleServiceChange(selectedService);
  const retryOperator = () => selectedCountry && handleCountryChange(selectedCountry.number_id);

  const handleOperatorChange = (id) => {
    const op = operators.find(o => String(o.id) === String(id));
    setSelectedOperator(op || null);
  };

  const handleOrder = async () => {
    if (!selectedService || !selectedCountry || !selectedProvider || !selectedOperator) {
      setError('Lengkapi semua pilihan terlebih dahulu'); return;
    }
    setOrdering(true); setError('');
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          number_id: selectedCountry.number_id,
          provider_id: selectedProvider.provider_id,
          operator_id: selectedOperator.id,
          price: selectedProvider.price,
          service: services.find(s => String(s.service_code) === String(selectedService))?.service_name || '',
          country: selectedCountry.name,
          operator: selectedOperator.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      showToast('🎉 Pembelian nomor berhasil!');
      await loadActiveOrders();
      await refreshProfile();
    } catch (e) { setError('Gagal membuat order: ' + e.message); }
    setOrdering(false);
  };

  const handleAction = async (orderId, action) => {
    setActionLoading(orderId);
    try {
      const res = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ order_id: orderId, status: action }),
      });
      const data = await res.json();
      if (data.success) {
        if (action === 'cancel') {
          await refreshProfile();
          showToast('✅ Order dibatalkan & saldo di-refund');
        } else {
          showToast('✅ Berhasil meminta OTP ulang');
        }
        await loadActiveOrders();
      } else {
        showToast('❌ Gagal: ' + (data.error || 'Kesalahan server'));
      }
    } catch {
      showToast('❌ Terjadi kesalahan jaringan');
    }
    setActionLoading(null);
  };

  if (!ready || !session) return null;

  const serviceName = services.find(s => String(s.service_code) === String(selectedService))?.service_name || '';

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
            <p>Pilih layanan dan beli nomor virtual dalam satu form</p>
          </div>

          <div className="grid-2" style={{ gap: 24, alignItems: 'flex-start' }}>

            {/* ── Left: Order Form ── */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>🛒 Form Order</div>

              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

              {/* Saldo */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>💰 Saldo kamu</span>
                <strong style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontSize: '1.05rem' }}>
                  Rp{Number(profile?.balance || 0).toLocaleString('id-ID')}
                </strong>
              </div>

              {/* Service Dropdown */}
              <DropdownField
                label="Layanan / Aplikasi"
                placeholder="— Pilih aplikasi —"
                options={services}
                value={selectedService}
                onChange={handleServiceChange}
                loading={loadingSvc}
                error={errorSvc}
                onRetry={loadServices}
                disabled={false}
                keyField="service_code"
                labelField="service_name"
              />

              {/* Country Dropdown */}
              <DropdownField
                label="Negara"
                placeholder="— Pilih negara —"
                options={countries}
                value={selectedCountry?.number_id || ''}
                onChange={handleCountryChange}
                loading={loadingCtry}
                error={errorCtry}
                onRetry={retryCountry}
                disabled={!selectedService}
                keyField="number_id"
                labelField="name"
              />

              {/* Operator Dropdown */}
              <DropdownField
                label="Operator"
                placeholder="— Pilih operator —"
                options={operators}
                value={selectedOperator?.id || ''}
                onChange={(id) => { const op = operators.find(o => String(o.id) === id); setSelectedOperator(op || null); }}
                loading={loadingOp}
                error={errorOp}
                onRetry={retryOperator}
                disabled={!selectedCountry}
                keyField="id"
                labelField="name"
              />

              {/* Price summary */}
              {selectedProvider && selectedOperator && (
                <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>Harga per OTP</span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>
                    {selectedProvider.price_format || `Rp${Number(selectedProvider.price).toLocaleString('id-ID')}`}
                  </span>
                </div>
              )}

              {/* Insufficient balance warning */}
              {selectedProvider && (profile?.balance || 0) < selectedProvider.price && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  Saldo tidak cukup. <a href="/deposit" style={{ color: 'var(--accent)' }}>Top up sekarang →</a>
                </div>
              )}

              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={handleOrder}
                disabled={ordering || !selectedService || !selectedCountry || !selectedOperator || (profile?.balance || 0) < (selectedProvider?.price || 0)}>
                {ordering
                  ? <><span className="spinner" style={{ width: 16, height: 16 }}></span> Memesan...</>
                  : 'Beli Nomor'}
              </button>
            </div>

            {/* ── Right: Active Order / OTP Monitor ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeOrders.length > 0 ? (
                activeOrders.map(order => {
                  const remainingMs = order.expires_at ? new Date(order.expires_at) - Date.now() : 0;
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

                        {order.otp_code && order.otp_code !== '-' ? (
                          <>
                            <div className="otp-number">{order.otp_code}</div>
                            <div className="alert alert-success" style={{ marginTop: 12, display: 'inline-block' }}>
                              ✅ OTP Berhasil!
                            </div>
                          </>
                        ) : (
                          <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-2)', fontSize: '0.85rem' }}>
                            <span className="spinner" style={{ width: 14, height: 14 }}></span> Menunggu OTP...
                          </div>
                        )}

                        <div className="timer" style={{ marginTop: 12 }}>
                          ⏱ {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                        </div>
                        <div style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginTop: 4 }}>Waktu tersisa</div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {(!order.otp_code || order.otp_code === '-') && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleAction(order.order_id, 'resend')} disabled={actionLoading === order.order_id}>
                              🔄 Minta OTP Ulang
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleAction(order.order_id, 'cancel')} disabled={actionLoading === order.order_id}>
                              ✕ Batalkan
                            </button>
                          </>
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
