/**
 * OTP Provider — SMS Bower
 * Docs: https://documenter.getpostman.com/view/16514200/2sAYdkFTue
 * Base URL: https://smsbower.page/stubs/handler_api.php
 */

// ─── Config ─────────────────────────────────────────────────────────────────
const SMSBOWER_BASE  = 'https://smsbower.page/stubs/handler_api.php';
const SMSBOWER_KEY   = process.env.SMSBOWER_API_KEY || 'P37lcf64UAfiAVvTtli1MY4NG3hY1A09';

// Kurs USD → IDR: bisa diubah via admin dashboard (disimpan di settings cache).
// Fallback urutan: _rateCache (set by admin API) → DB Supabase → env USD_TO_IDR → 16500
let _rateCache = null; // { usdToIdr, markup, ts }
const RATE_TTL_MS = 60 * 60 * 1000; // 1 jam

// ─── Supabase client for DB rate fetch (server-side only) ──────────────────
let _supabaseForRate = null;
function getSupabaseClient() {
  if (_supabaseForRate) return _supabaseForRate;
  // Lazy import agar tidak circular
  try {
    const { getServiceSupabase } = require('./supabase');
    _supabaseForRate = getServiceSupabase();
  } catch { /* ignore — will use env fallback */ }
  return _supabaseForRate;
}

export function setRateCache(usdToIdr, markup) {
  _rateCache = { usdToIdr, markup, ts: Date.now() };
}

/**
 * Load rate dari DB Supabase settings — dipanggil saat cache kosong.
 * Return { usdToIdr, markup } atau null jika gagal.
 */
async function loadRateFromDB() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data: rows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['usd_to_idr', 'otp_price_markup']);
    if (!rows || rows.length === 0) return null;
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const usdToIdr = parseFloat(map.usd_to_idr);
    const markup   = parseFloat(map.otp_price_markup);
    if (isNaN(usdToIdr) || usdToIdr < 1000) return null;
    if (isNaN(markup)   || markup < 1)       return null;
    console.log(`[otpProvider] Rate loaded from DB: $1 = Rp${usdToIdr} markup=${markup}x`);
    return { usdToIdr, markup };
  } catch (e) {
    console.warn('[otpProvider] loadRateFromDB failed:', e.message);
    return null;
  }
}

async function getUsdToIdrAsync() {
  if (_rateCache && Date.now() - _rateCache.ts < RATE_TTL_MS) {
    return _rateCache.usdToIdr;
  }
  // Cache kosong (cold-start / restart) — coba load dari DB
  const db = await loadRateFromDB();
  if (db) {
    setRateCache(db.usdToIdr, db.markup);
    return db.usdToIdr;
  }
  const envRate = parseFloat(process.env.USD_TO_IDR || '16500');
  return isNaN(envRate) ? 16500 : envRate;
}

async function getMarkupAsync() {
  if (_rateCache && Date.now() - _rateCache.ts < RATE_TTL_MS) {
    return _rateCache.markup;
  }
  // Cache kosong — coba load dari DB
  const db = await loadRateFromDB();
  if (db) {
    setRateCache(db.usdToIdr, db.markup);
    return db.markup;
  }
  const envMarkup = parseFloat(process.env.OTP_PRICE_MARKUP || '1.7');
  return isNaN(envMarkup) ? 1.7 : envMarkup;
}

// Sync versions (kept for backward compat, use async versions in price calc)
function getUsdToIdr() {
  if (_rateCache && Date.now() - _rateCache.ts < RATE_TTL_MS) {
    return _rateCache.usdToIdr;
  }
  const envRate = parseFloat(process.env.USD_TO_IDR || '16500');
  return isNaN(envRate) ? 16500 : envRate;
}

function getMarkup() {
  if (_rateCache && Date.now() - _rateCache.ts < RATE_TTL_MS) {
    return _rateCache.markup;
  }
  const envMarkup = parseFloat(process.env.OTP_PRICE_MARKUP || '1.7');
  return isNaN(envMarkup) ? 1.7 : envMarkup;
}

// ─── Simple TTL In-Memory Cache ──────────────────────────────────────────────
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

/**
 * Flush semua cache harga layanan — dipanggil saat admin update kurs/markup
 * agar harga langsung dihitung ulang dengan nilai baru.
 */
export function clearPriceCache() {
  for (const key of _cache.keys()) {
    if (key.startsWith('sb:svc:') || key.startsWith('sb:countries:')) {
      _cache.delete(key);
    }
  }
  console.log('[otpProvider] Price cache cleared');
}

// ─── Rate Limiter: max 10 requests per 10 seconds (sliding window) ────────────
const RATE_LIMIT      = 10;
const RATE_WINDOW_MS  = 10_000;
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

// ─── Generic Fetch (plain-text + JSON responses) ─────────────────────────────
// SMS Bower returns plain text for most endpoints (e.g. ACCESS_NUMBER:id:phone)
// and JSON for getCountries, getServicesList, getPrices etc.
async function fetchSmsBower(params) {
  await waitForSlot();
  const qs = new URLSearchParams({ api_key: SMSBOWER_KEY, ...params });
  const url = `${SMSBOWER_BASE}?${qs.toString()}`;
  console.log('[SmsBower]', url);

  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();

  if (!res.ok) {
    console.error('[SmsBower Error]', params.action, res.status, text);
    return { _raw: text, success: false, message: `HTTP ${res.status}` };
  }

  // Try JSON first; fall back to raw text
  try {
    const json = JSON.parse(text);
    return { _raw: text, _json: json, success: true };
  } catch {
    return { _raw: text, success: true };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── NEGARA (Countries) ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns list of countries.
 * SMS Bower: action=getCountries → [{ id, rus, eng, chn }]
 * If serviceId provided, use getPrices to filter countries that have stock.
 */
async function getCountriesSmsBower(serviceId) {
  if (serviceId) {
    return getCountriesForServiceSmsBower(serviceId);
  }

  const CACHE_KEY = 'sb:countries_all';
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const res = await fetchSmsBower({ action: 'getCountries' });
  if (!res.success || !res._json) return { success: false, data: [] };

  // Response is an object: { "0": { id: 0, rus: "...", eng: "..." }, "1": {...} }
  const raw = res._json;
  const data = Object.values(raw)
    .filter(c => c && c.eng)
    .map(c => ({
      id: String(c.id),
      name: c.eng,
    }));

  return cacheSet(CACHE_KEY, { success: true, data });
}

/**
 * Get countries that have stock for a specific service, using getPricesV3.
 * V3 response: { "countryCode": { "serviceCode": { "providerId": { count, price, provider_id } } } }
 */
async function getCountriesForServiceSmsBower(serviceCode) {
  const markup   = await getMarkupAsync();
  const usdToIdr = await getUsdToIdrAsync();
  const CACHE_KEY = `sb:countries:svc3:${serviceCode}:m${markup}:r${usdToIdr}`;
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const res = await fetchSmsBower({ action: 'getPricesV3', service: serviceCode });
  if (!res.success || !res._json) return { success: false, data: [] };

  // V3: { "countryCode": { "serviceCode": { "providerId": { count, price, provider_id } } } }
  const entries = [];
  for (const [countryId, services] of Object.entries(res._json)) {
    const providers = services[serviceCode];
    if (!providers || typeof providers !== 'object') continue;

    let totalStock = 0;
    const validProviders = [];
    for (const provEntry of Object.values(providers)) {
      const cnt  = Number(provEntry?.count)  || 0;
      const usdP = parseFloat(provEntry?.price) || 0;
      const pid  = String(provEntry?.provider_id ?? '');
      if (cnt <= 0 || usdP <= 0) continue;
      totalStock += cnt;
      validProviders.push({ usdP, cnt, pid });
    }
    if (totalStock <= 0 || validProviders.length === 0) continue;

    // Pick cheapest provider with significant stock
    const minSigStock = Math.max(Math.ceil(totalStock * 0.01), 500);
    const sigProviders = validProviders.filter(p => p.cnt >= minSigStock);
    const pool = sigProviders.length > 0 ? sigProviders : validProviders;
    const cheapest = pool.reduce((best, p) => p.usdP < best.usdP ? p : best, pool[0]);

    const price = Math.ceil(cheapest.usdP * usdToIdr * markup);
    entries.push({
      id: String(countryId),
      name: String(countryId),
      price,
      price_format: `Rp${price.toLocaleString('id-ID')}`,
      stock: totalStock,
      _sub: `Rp${price.toLocaleString('id-ID')} · stok: ${totalStock.toLocaleString()}`,
      cheapest_provider_id: cheapest.pid,
      cheapest_price_usd: cheapest.usdP,
    });
  }

  // Enrich with country names
  const allCtry = await getCountriesSmsBower();
  if (allCtry.success) {
    const ctryMap = new Map(allCtry.data.map(c => [c.id, c.name]));
    entries.forEach(e => { e.name = ctryMap.get(e.id) || e.name; });
  }

  const result = { success: true, data: entries.filter(e => e.stock > 0) };
  return cacheSet(CACHE_KEY, result);
}

export async function getCountries(server = 'smsbower', serviceId) {
  return getCountriesSmsBower(serviceId);
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── LAYANAN (Services / Apps) ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns all available services/apps.
 * SMS Bower: action=getServicesList → { status, services: [{ code, name }] }
 */
async function getServicesSmsBower() {
  const CACHE_KEY = 'sb:services_all';
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const res = await fetchSmsBower({ action: 'getServicesList' });
  if (!res.success || !res._json) return { success: false, data: [] };

  const json = res._json;
  if (json.status !== 'success' || !Array.isArray(json.services)) {
    return { success: false, data: [] };
  }

  const data = {
    success: true,
    data: json.services.map(s => ({
      service_code: String(s.code),
      service_name: s.name,
    })),
  };
  return cacheSet(CACHE_KEY, data);
}

/**
 * Returns services for a given country, with price + stock.
 * Uses getPricesV3 — explicit per-provider price + count.
 * V3 response: { "countryCode": { "serviceCode": { "providerId": { count, price, provider_id } } } }
 */
async function getServicesForCountrySmsBower(countryId) {
  const markup   = await getMarkupAsync();
  const usdToIdr = await getUsdToIdrAsync();
  const CACHE_KEY = `sb:svc3:${countryId}:m${markup}:r${usdToIdr}`;
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  // Fetch V3 prices + full service name list in parallel
  const [res, allSvcRes] = await Promise.all([
    fetchSmsBower({ action: 'getPricesV3', country: countryId }),
    getServicesSmsBower(),
  ]);
  if (!res.success || !res._json) return { success: false, data: [] };

  // Build service code → name map
  const nameMap = new Map();
  if (allSvcRes.success && allSvcRes.data) {
    allSvcRes.data.forEach(s => nameMap.set(String(s.service_code), s.service_name));
  }

  // V3: { "countryCode": { "serviceCode": { "providerId": { count, price, provider_id } } } }
  const countryData = res._json[String(countryId)];
  if (!countryData) return { success: false, data: [] };

  const data = [];
  for (const [code, providers] of Object.entries(countryData)) {
    if (!providers || typeof providers !== 'object') continue;

    // Parse semua provider untuk layanan ini
    let totalStock = 0;
    const validProviders = [];
    for (const provEntry of Object.values(providers)) {
      const cnt  = Number(provEntry?.count)  || 0;
      const usdP = parseFloat(provEntry?.price) || 0;
      const pid  = String(provEntry?.provider_id ?? '');
      if (cnt <= 0 || usdP <= 0) continue;
      totalStock += cnt;
      validProviders.push({ usdP, cnt, pid });
    }
    if (totalStock <= 0 || validProviders.length === 0) continue;

    // Pilih provider termurah dengan stok signifikan (≥1% total atau ≥500)
    const minSigStock = Math.max(Math.ceil(totalStock * 0.01), 500);
    const sigProviders = validProviders.filter(p => p.cnt >= minSigStock);
    const pool = sigProviders.length > 0 ? sigProviders : validProviders;
    // Provider termurah dari pool yang reliable
    const cheapest = pool.reduce((best, p) => p.usdP < best.usdP ? p : best, pool[0]);

    const price = Math.ceil(cheapest.usdP * usdToIdr * markup);
    console.log(`[price/v3] ${code}@${countryId}: providers=${validProviders.length} sig=${pool.length} cheapest=$${cheapest.usdP} pid=${cheapest.pid} → Rp${price} (rate=${usdToIdr}×markup=${markup})`);

    const serviceName = nameMap.get(code) || nameMap.get(code.toLowerCase()) || code.toUpperCase();
    data.push({
      service_code: code,
      service_name: serviceName,
      price,
      price_format: `Rp${price.toLocaleString('id-ID')}`,
      stock: totalStock,
      _sub: `Rp${price.toLocaleString('id-ID')} · stok: ${totalStock.toLocaleString()}`,
      cheapest_provider_id: cheapest.pid,   // dipakai saat order untuk lock harga
      cheapest_price_usd:   cheapest.usdP,
    });
  }

  data.sort((a, b) => a.price - b.price);
  const result = { success: true, data };
  return cacheSet(CACHE_KEY, result);
}

export async function getServicesServer4() {
  return getServicesSmsBower();
}

export async function getServicesForCountryServer4(countryId) {
  return getServicesForCountrySmsBower(countryId);
}

export async function getServices(countryId, server = 'smsbower') {
  return getServicesForCountrySmsBower(countryId);
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── OPERATORS ─────────────────────────────────────────────────────────────
// SMS Bower does not have an explicit operators endpoint.
// We return a single "any" option so the frontend can proceed.
// ═══════════════════════════════════════════════════════════════════════════

export async function getOperators(countryId, server = 'smsbower', country, providerId) {
  // SMS Bower has no operator selection — return a default "any" option
  return {
    success: true,
    data: [{ id: 'any', name: 'Any (otomatis)' }],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── CREATE ORDER ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Order a phone number.
 * SMS Bower: action=getNumber → ACCESS_NUMBER:$activationId:$phoneNumber
 * providerIds: pass cheapest provider ID dari getPricesV3 untuk lock harga.
 */
async function createOrderSmsBower(countryId, serviceCode, { maxPrice, providerIds } = {}) {
  const params = {
    action: 'getNumber',
    service: serviceCode,
    country: countryId,
  };
  // Lock ke provider termurah yang ditampilkan → harga akurat
  if (providerIds) params.providerIds = String(providerIds);
  // maxPrice sebagai safety net agar tidak dicharge lebih dari harga yang ditampilkan
  if (maxPrice)    params.maxPrice    = String(maxPrice);

  const res = await fetchSmsBower(params);
  if (!res.success) return { success: false, message: res.message || 'Order gagal' };

  const raw = res._raw || '';
  // Expected: ACCESS_NUMBER:12345678:79001234567
  if (!raw.startsWith('ACCESS_NUMBER:')) {
    console.error('[SmsBower createOrder] unexpected response:', raw);
    return { success: false, message: raw || 'Nomor tidak tersedia' };
  }

  const parts = raw.split(':');
  const activationId = parts[1];
  const phoneNumber  = parts[2];

  return {
    success: true,
    data: {
      order_id: activationId,
      phone_number: phoneNumber,
      expires_in_seconds: 1490, // 24 menit 50 detik
    },
  };
}

export async function createOrder(countryId, serviceCode, operator, server = 'smsbower', extra = {}) {
  return createOrderSmsBower(countryId, serviceCode, {
    maxPrice:    extra.maxPrice,
    providerIds: extra.provider_id, // dari cheapest_provider_id di getPricesV3
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── CHECK ORDER STATUS (OTP) ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const WAITING_PLACEHOLDERS = ['menunggu', 'waiting', 'pending', '-', ''];

/**
 * Get current OTP status.
 * SMS Bower: action=getStatus&id=... →
 *   STATUS_WAIT_CODE        — waiting
 *   STATUS_WAIT_RETRY:code  — got code, waiting for next
 *   STATUS_OK:code          — OTP received
 *   STATUS_CANCEL           — canceled
 */
async function getOrderStatusSmsBower(orderId) {
  const res = await fetchSmsBower({ action: 'getStatus', id: orderId });
  console.log(`[SmsBower getStatus] order=${orderId}`, res._raw);

  if (!res.success) return { success: true, data: { status: 'waiting', otp_code: '-' } };

  const raw = (res._raw || '').trim();

  if (raw === 'STATUS_WAIT_CODE') {
    return { success: true, data: { status: 'waiting', otp_code: '-' } };
  }

  if (raw === 'STATUS_CANCEL') {
    return { success: true, data: { status: 'canceled', otp_code: '-' } };
  }

  if (raw.startsWith('STATUS_OK:')) {
    const code = raw.slice('STATUS_OK:'.length).trim();
    const isReal = code && !WAITING_PLACEHOLDERS.includes(code.toLowerCase());
    if (isReal) {
      return { success: true, data: { status: 'received', otp_code: code, otp_msg: code } };
    }
    return { success: true, data: { status: 'waiting', otp_code: '-' } };
  }

  if (raw.startsWith('STATUS_WAIT_RETRY:')) {
    const code = raw.slice('STATUS_WAIT_RETRY:'.length).trim();
    return { success: true, data: { status: 'waiting', otp_code: code || '-' } };
  }

  // Fallback
  return { success: true, data: { status: 'waiting', otp_code: '-' } };
}

export async function getOrderStatus(orderId, server = 'smsbower') {
  return getOrderStatusSmsBower(orderId);
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── CANCEL / ACTION ORDER ─────────────────────────────────────────────────
// SMS Bower: action=setStatus&id=...&status=8 (cancel)
//            action=setStatus&id=...&status=6 (confirm/done)
//            action=setStatus&id=...&status=3 (request another SMS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Set activation status.
 * Statuses: 1=ready, 3=request another, 6=confirm/complete, 8=cancel
 * Responses: ACCESS_READY, ACCESS_RETRY_GET, ACCESS_ACTIVATION, ACCESS_CANCEL
 */
async function setStatusSmsBower(orderId, statusCode) {
  const res = await fetchSmsBower({ action: 'setStatus', id: orderId, status: String(statusCode) });
  console.log(`[SmsBower setStatus] order=${orderId} status=${statusCode}`, res._raw);

  if (!res.success) return { success: false, message: res.message || 'Gagal ubah status' };

  const raw = (res._raw || '').trim();

  // Error responses
  if (raw === 'NO_ACTIVATION') return { success: false, message: 'Activation tidak ditemukan' };
  if (raw === 'BAD_STATUS')    return { success: false, message: 'Status tidak valid' };
  if (raw === 'BAD_KEY')       return { success: false, message: 'API key tidak valid' };
  if (raw === 'EARLY_CANCEL_DENIED') {
    return { success: false, message: 'Pesanan belum bisa dibatalkan. Tunggu minimal 2 menit setelah order baru bisa cancel.' };
  }

  // Success responses
  if (['ACCESS_CANCEL', 'ACCESS_ACTIVATION', 'ACCESS_READY', 'ACCESS_RETRY_GET'].includes(raw)) {
    return { success: true, data: { order_id: orderId, status: raw } };
  }

  return { success: false, message: raw || 'Respons tidak dikenal' };
}

export async function cancelOrder(orderId, server = 'smsbower') {
  return setStatusSmsBower(orderId, 8);
}

export async function doneOrder(orderId, server = 'smsbower') {
  return setStatusSmsBower(orderId, 6);
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── PROVIDER BALANCE (Admin only) ─────────────────────────────────────────
// SMS Bower: action=getBalance → ACCESS_BALANCE:amount
// ═══════════════════════════════════════════════════════════════════════════

async function getProviderBalanceSmsBower() {
  const res = await fetchSmsBower({ action: 'getBalance' });
  if (!res.success) return { success: false, data: null };

  const raw = (res._raw || '').trim();
  // Expected: ACCESS_BALANCE:123.45
  if (!raw.startsWith('ACCESS_BALANCE:')) {
    return { success: false, data: null };
  }

  const bal = parseFloat(raw.slice('ACCESS_BALANCE:'.length)) || 0;
  return {
    success: true,
    data: {
      balance: bal,
      formated: `$${bal.toFixed(2)}`,
      username: 'SmsBower',
      email: 'SmsBower Account',
    },
  };
}

export async function getProviderBalance(server = 'smsbower') {
  return getProviderBalanceSmsBower();
}
