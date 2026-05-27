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

// ─── Rate Limiter: max 5 requests per 10 seconds (sliding window) ─────────────
const RATE_LIMIT = 5;
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

// Server 4: RuangOTP /v2/countries?service_id=...
// Returns countries with pricelist. We expose each country + its providers.
async function getCountriesServer4(serviceId = 13) {
  const result = await fetchRuangOTP(`/v2/countries?service_id=${serviceId}`);
  if (!result.success || !result.data) return { success: false, data: [] };
  return {
    success: true,
    data: result.data.map(c => ({
      id: String(c.number_id),
      name: c.name,
      prefix: c.prefix,
      iso_code: c.iso_code,
      stock: c.stock_total,
      pricelist: c.pricelist || [],
    })),
  };
}

export async function getCountries(server = 'server3', serviceId) {
  if (server === 'server4') return getCountriesServer4(serviceId);
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

// Server 4: RuangOTP /v2/services (global list of apps)
async function getServicesServer4() {
  const result = await fetchRuangOTP('/v2/services');
  if (!result.success || !result.data) return { success: false, data: [] };
  return {
    success: true,
    data: result.data.map(s => ({
      service_code: String(s.service_code),
      service_name: s.service_name,
      service_img: s.service_img,
      price: 0,
      stock: 0,
    })),
  };
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
