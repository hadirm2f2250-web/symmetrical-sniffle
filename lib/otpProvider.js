/**
 * OTP Multi-Server Provider
 * Server 3: JasaOTP  → https://api.jasaotp.id/v1/
 * Server 4: RuangOTP → https://www.rumahotp.io/api/
 */

// ─── Server Configs ─────────────────────────────────────────────────────────
const JASAOTP_BASE = 'https://api.jasaotp.id/v1';
const RUANGOTP_BASE = 'https://www.rumahotp.io/api';

const JASAOTP_API_KEY   = process.env.JASAOTP_API_KEY;
const RUANGOTP_API_KEY  = process.env.RUANGOTP_API_KEY || 'rk-dev-da3ilRoFIcTuN8ziGXJbc94m5ClhCyMB';

const SERVER_LABELS = {
  server3: 'Server 3 (JasaOTP)',
  server4: 'Server 4 (RuangOTP)',
};

// ─── Simple TTL In-Memory Cache ──────────────────────────────────────────────
// Prevents hammering RuangOTP with repeated calls within the same warm instance.
const _cache = new Map(); // key → { data, ts }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheGet(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  _cache.delete(key);
  return null;
}
function cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() });
  return data;
}

// ─── Rate Limiter: max 10 requests per 10 seconds (sliding window) ────────────
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10_000;
const requestTimestamps = [];


function waitForSlot() {
  return new Promise((resolve) => {
    function trySlot() {
      const now = Date.now();
      while (requestTimestamps.length && requestTimestamps[0] <= now - RATE_WINDOW_MS) {
        requestTimestamps.shift();
      }
      if (requestTimestamps.length < RATE_LIMIT) {
        requestTimestamps.push(now);
        resolve();
      } else {
        const waitMs = RATE_WINDOW_MS - (now - requestTimestamps[0]) + 10;
        setTimeout(trySlot, waitMs);
      }
    }
    trySlot();
  });
}

// ─── Generic Fetch (JasaOTP style) ────────────────────────────────────────────
async function fetchJasaOTP(path) {
  await waitForSlot();
  const url = `${JASAOTP_BASE}${path}`;
  console.log('[JasaOTP]', url);
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
  if (!res.ok) console.error('[JasaOTP Error]', path, res.status, JSON.stringify(json));
  return json;
}

// ─── Generic Fetch (RuangOTP style) ───────────────────────────────────────────
async function fetchRuangOTP(path) {
  await waitForSlot();
  const url = `${RUANGOTP_BASE}${path}`;
  console.log('[RuangOTP]', url);
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'x-apikey': RUANGOTP_API_KEY,
      'Accept': 'application/json',
    },
  });
  const json = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
  if (!res.ok) console.error('[RuangOTP Error]', path, res.status, JSON.stringify(json));
  return json;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── NEGARA (Countries) ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Server 3: JasaOTP /negara.php
async function getCountriesServer3() {
  const result = await fetchJasaOTP('/negara.php');
  if (!result.success) return { success: false, data: [] };
  return {
    success: true,
    data: result.data.map(n => ({
      id: String(n.id_negara),
      name: n.nama_negara,
    })),
  };
}

// Server 4: build a full country+service+pricelist map (cached for 5 min)
async function buildCountryServiceMap() {
  const CACHE_KEY = 's4:country_service_map';
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const svcRes = await fetchRuangOTP('/v2/services');
  if (!svcRes.success || !svcRes.data?.length) return null;

  // Fetch countries for each service in parallel
  const results = await Promise.all(
    svcRes.data.map(s =>
      fetchRuangOTP(`/v2/countries?service_id=${s.service_code}`)
        .then(r => ({ service: s, result: r }))
        .catch(() => ({ service: s, result: { success: false } }))
    )
  );

  // Build: countryName → { id, name, iso_code, services: { serviceCode → { service, pricelist } } }
  const map = new Map();
  results.forEach(({ service, result }) => {
    if (!result.success || !result.data) return;
    result.data.forEach(c => {
      if (!map.has(c.name)) {
        map.set(c.name, { id: String(c.number_id), name: c.name, iso_code: c.iso_code, services: {} });
      }
      map.get(c.name).services[service.service_code] = {
        service,
        pricelist: c.pricelist || [],
        stock_total: c.stock_total,
        number_id: c.number_id,
      };
    });
  });

  return cacheSet(CACHE_KEY, map);
}

// Server 4: get deduplicated country list
async function getCountriesServer4() {
  const map = await buildCountryServiceMap();
  if (!map) return { success: false, data: [] };
  const data = Array.from(map.values()).map(c => ({ id: c.id, name: c.name, iso_code: c.iso_code }));
  return { success: true, data };
}

// Server 4: get services available for a specific country (cached via shared map)
export async function getServicesForCountryServer4(countryName) {
  const CACHE_KEY = `s4:svc:${countryName.toLowerCase()}`;
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const map = await buildCountryServiceMap();
  if (!map) return { success: false, data: [] };

  // Find country in map (case-insensitive)
  const entry = Array.from(map.values()).find(
    c => c.name.toLowerCase() === countryName.toLowerCase()
  );
  if (!entry) return { success: false, data: [] };

  const available = [];
  Object.values(entry.services).forEach(({ service, pricelist, stock_total, number_id }) => {
    const active = pricelist.filter(p => p.available);
    if (!active.length) return;
    const best = active.reduce((a, b) => (a.price <= b.price ? a : b));
    available.push({
      service_code: String(service.service_code),
      service_name: service.service_name,
      service_img: service.service_img,
      provider_id: String(best.provider_id),
      number_id: String(number_id),
      price: best.price,
      price_format: best.price_format,
      stock: stock_total,
    });
  });

  return cacheSet(CACHE_KEY, { success: true, data: available });
}

// Server 4: countries for a specific service/app (with cheapest provider embedded)
async function getCountriesForServiceServer4(serviceId) {
  const CACHE_KEY = `s4:countries:svc:${serviceId}`;
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const result = await fetchRuangOTP(`/v2/countries?service_id=${serviceId}`);
  if (!result.success || !result.data) return { success: false, data: [] };

  const markup = parseFloat(process.env.OTP_PRICE_MARKUP || '1.5');
  const data = result.data
    .map(c => {
      const pricelist = (c.pricelist || []).filter(p => p.available);
      if (!pricelist.length) return null;
      const best = pricelist.reduce((a, b) => (a.price <= b.price ? a : b));
      const priceMarked = Math.ceil(best.price * markup);
      return {
        id: String(c.number_id),
        name: c.name,
        iso_code: c.iso_code,
        provider_id: String(best.provider_id),
        price: priceMarked,
        price_format: `Rp${priceMarked.toLocaleString('id-ID')}`,
        stock: c.stock_total,
        _sub: `Rp${priceMarked.toLocaleString('id-ID')} · stok: ${c.stock_total}`,
      };
    })
    .filter(Boolean);

  return cacheSet(CACHE_KEY, { success: true, data });
}

export async function getCountries(server = 'server3', serviceId) {
  if (server === 'server4') {
    if (serviceId) return getCountriesForServiceServer4(serviceId);
    return getCountriesServer4(); // fallback: all countries deduplicated
  }
  return getCountriesServer3();
}


// ═══════════════════════════════════════════════════════════════════════════
// ─── LAYANAN (Services / Apps) ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Server 3: JasaOTP /layanan.php?negara=ID
async function getServicesServer3(countryId) {
  const result = await fetchJasaOTP(`/layanan.php?negara=${countryId}`);
  const countryData = result[String(countryId)];
  if (!countryData) return { success: false, data: [] };

  const services = Object.entries(countryData).map(([code, info]) => ({
    service_code: code,
    service_name: info.layanan || code,
    price: info.harga,
    stock: info.stok,
  }));
  return { success: true, data: services };
}

// Server 4: RuangOTP /v2/services (global list of apps) — cached
export async function getServicesServer4() {
  const CACHE_KEY = 's4:services_all';
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const result = await fetchRuangOTP('/v2/services');
  if (!result.success || !result.data) return { success: false, data: [] };
  const data = {
    success: true,
    data: result.data.map(s => ({
      service_code: String(s.service_code),
      service_name: s.service_name,
      service_img: s.service_img,
    })),
  };
  return cacheSet(CACHE_KEY, data);
}


export async function getServices(countryId, server = 'server3') {
  if (server === 'server4') return getServicesServer4();
  return getServicesServer3(countryId);
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── OPERATORS ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Server 3: JasaOTP /operator.php?negara=ID
async function getOperatorsServer3(countryId) {
  const result = await fetchJasaOTP(`/operator.php?negara=${countryId}`);
  if (!result.success) return { success: false, data: [] };
  const ops = result.data[String(countryId)];
  if (!ops || !Array.isArray(ops)) return { success: true, data: [] };
  return {
    success: true,
    data: ops.map(name => ({ id: name, name })),
  };
}

// Server 4: RuangOTP /v2/operators?country=NAME&provider_id=ID
async function getOperatorsServer4(country, providerId) {
  const result = await fetchRuangOTP(`/v2/operators?country=${encodeURIComponent(country)}&provider_id=${providerId}`);
  if (!result.success || !result.data) return { success: false, data: [] };
  return {
    success: true,
    data: result.data.map(op => ({
      id: String(op.id),
      name: op.name,
      image: op.image,
    })),
  };
}

export async function getOperators(countryId, server = 'server3', country, providerId) {
  if (server === 'server4') return getOperatorsServer4(country || countryId, providerId || countryId);
  return getOperatorsServer3(countryId);
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── CREATE ORDER ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Server 3: JasaOTP
async function createOrderServer3(countryId, serviceCode, operator) {
  const result = await fetchJasaOTP(
    `/order.php?api_key=${JASAOTP_API_KEY}&negara=${countryId}&layanan=${encodeURIComponent(serviceCode)}&operator=${encodeURIComponent(operator)}`
  );
  if (!result.success) {
    return { success: false, message: result.message || 'Order gagal' };
  }
  return {
    success: true,
    data: {
      order_id: result.data.order_id,
      phone_number: result.data.number,
      expires_in_minute: 9.5,
    },
  };
}

// Server 4: RuangOTP /v2/orders
async function createOrderServer4(numberId, providerId, operatorId) {
  const result = await fetchRuangOTP(
    `/v2/orders?number_id=${numberId}&provider_id=${providerId}&operator_id=${operatorId}`
  );
  if (!result.success || !result.data) {
    return { success: false, message: result.message || 'Order gagal di RuangOTP' };
  }
  const d = result.data;
  return {
    success: true,
    data: {
      order_id: d.order_id,
      phone_number: d.phone_number,
      expires_in_minute: 20, // RuangOTP max 20 menit
      price_original: d.price,
      service: d.service,
      country: d.country,
      operator: d.operator,
    },
  };
}

export async function createOrder(countryId, serviceCode, operator, server = 'server3', extra = {}) {
  if (server === 'server4') {
    // extra: { number_id, provider_id, operator_id }
    return createOrderServer4(extra.number_id || countryId, extra.provider_id || serviceCode, extra.operator_id || operator);
  }
  return createOrderServer3(countryId, serviceCode, operator);
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── CHECK ORDER STATUS (OTP) ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const WAITING_PLACEHOLDERS = ['menunggu', 'waiting', 'pending', '-', ''];

// Server 3: JasaOTP /sms.php
async function getOrderStatusServer3(orderId) {
  const result = await fetchJasaOTP(`/sms.php?api_key=${JASAOTP_API_KEY}&id=${orderId}`);
  console.log(`[JasaOTP sms.php] order=${orderId}`, JSON.stringify(result));

  const otp = result?.data?.otp;
  const isRealOtp = otp && !WAITING_PLACEHOLDERS.includes(String(otp).trim().toLowerCase());

  if (result.success && isRealOtp) {
    return { success: true, data: { status: 'received', otp_code: String(otp), otp_msg: String(otp) } };
  }
  return { success: true, data: { status: 'waiting', otp_code: '-' } };
}

// Server 4: RuangOTP /v1/orders/get_status
async function getOrderStatusServer4(orderId) {
  const result = await fetchRuangOTP(`/v1/orders/get_status?order_id=${orderId}`);
  console.log(`[RuangOTP get_status] order=${orderId}`, JSON.stringify(result));

  if (!result.success) return { success: true, data: { status: 'waiting', otp_code: '-' } };

  const d = result.data;
  // Possible statuses: received, completed, canceled, expiring
  const hasOtp = d.otp_code && !WAITING_PLACEHOLDERS.includes(String(d.otp_code).trim().toLowerCase());

  if (hasOtp) {
    return {
      success: true,
      data: {
        status: 'received',
        otp_code: String(d.otp_code),
        otp_msg: d.otp_msg || String(d.otp_code),
        provider_status: d.status,
      },
    };
  }

  // Map provider status to our status
  let mappedStatus = 'waiting';
  if (d.status === 'canceled') mappedStatus = 'canceled';
  else if (d.status === 'expiring') mappedStatus = 'expiring';
  else if (d.status === 'completed') mappedStatus = 'completed';

  return { success: true, data: { status: mappedStatus, otp_code: '-' } };
}

export async function getOrderStatus(orderId, server = 'server3') {
  if (server === 'server4') return getOrderStatusServer4(orderId);
  return getOrderStatusServer3(orderId);
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── CANCEL / ACTION ORDER ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Server 3: JasaOTP /cancel.php
async function cancelOrderServer3(orderId) {
  const result = await fetchJasaOTP(`/cancel.php?api_key=${JASAOTP_API_KEY}&id=${orderId}`);
  if (!result.success) {
    let msg = result.message || 'Gagal membatalkan order';
    if (typeof msg === 'string' && msg.includes('EARLY_CANCEL_DENIED')) {
      msg = 'Pesanan belum bisa dibatalkan. Tunggu minimal 2 menit setelah order baru bisa cancel.';
    }
    return { success: false, message: msg };
  }
  return {
    success: true,
    data: { order_id: result.data.order_id, refunded_amount: result.data.refunded_amount },
  };
}

// Server 4: RuangOTP /v1/orders/set_status?status=cancel|done
async function setOrderStatusServer4(orderId, status) {
  const result = await fetchRuangOTP(`/v1/orders/set_status?order_id=${orderId}&status=${status}`);
  console.log(`[RuangOTP set_status] order=${orderId} status=${status}`, JSON.stringify(result));
  if (!result.success) {
    return { success: false, message: result.message || 'Gagal ubah status order' };
  }
  return { success: true, data: result.data };
}

export async function cancelOrder(orderId, server = 'server3') {
  if (server === 'server4') return setOrderStatusServer4(orderId, 'cancel');
  return cancelOrderServer3(orderId);
}

export async function doneOrder(orderId, server = 'server3') {
  if (server === 'server4') return setOrderStatusServer4(orderId, 'done');
  // Server 3 tidak punya endpoint done — cukup mark di DB saja
  return { success: true, data: { order_id: orderId } };
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── PROVIDER BALANCE (Admin only) ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function getProviderBalanceServer3() {
  const result = await fetchJasaOTP(`/balance.php?api_key=${JASAOTP_API_KEY}`);
  if (!result.success) return { success: false, data: null };
  return {
    success: true,
    data: {
      balance: result.data.saldo,
      formated: `Rp${Number(result.data.saldo).toLocaleString('id-ID')}`,
      username: 'JasaOTP',
      email: SERVER_LABELS.server3,
    },
  };
}

async function getProviderBalanceServer4() {
  // RuangOTP: GET /v1/user/balance (or /v1/profile) — check what's available
  // Using profile endpoint pattern
  const result = await fetchRuangOTP('/v1/user/balance');
  if (!result.success) return { success: false, data: null };
  const bal = result.data?.balance ?? result.data?.saldo ?? 0;
  return {
    success: true,
    data: {
      balance: bal,
      formated: `Rp${Number(bal).toLocaleString('id-ID')}`,
      username: 'RuangOTP',
      email: SERVER_LABELS.server4,
    },
  };
}

export async function getProviderBalance(server = 'server3') {
  if (server === 'server4') return getProviderBalanceServer4();
  return getProviderBalanceServer3();
}
