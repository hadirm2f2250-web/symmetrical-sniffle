const RUMAHOTP_BASE = 'https://www.rumahotp.com';
const API_KEY = process.env.RUMAHOTP_API_KEY;

const headers = {
  'x-apikey': API_KEY,
  'Accept': 'application/json',
};

// ─── Rate Limiter: max 5 requests per 10 seconds (sliding window) ────────────
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10_000;
const requestTimestamps = [];

function waitForSlot() {
  return new Promise((resolve) => {
    function trySlot() {
      const now = Date.now();
      // Remove timestamps older than 10s
      while (requestTimestamps.length && requestTimestamps[0] <= now - RATE_WINDOW_MS) {
        requestTimestamps.shift();
      }
      if (requestTimestamps.length < RATE_LIMIT) {
        requestTimestamps.push(now);
        resolve();
      } else {
        // Wait until the oldest slot expires
        const waitMs = RATE_WINDOW_MS - (now - requestTimestamps[0]) + 10;
        setTimeout(trySlot, waitMs);
      }
    }
    trySlot();
  });
}

async function fetchRumahOTP(path) {
  await waitForSlot(); // throttle sebelum request
  const res = await fetch(`${RUMAHOTP_BASE}${path}`, { headers, cache: 'no-store' });
  const json = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
  if (!res.ok) {
    console.error('[RumahOTP Error]', path, res.status, JSON.stringify(json));
  }
  return json;
}


// ─── Services ───────────────────────────────────────────────────────────────
export async function getServices() {
  return fetchRumahOTP('/api/v2/services');
}

// ─── Countries ──────────────────────────────────────────────────────────────
export async function getCountries(service_id) {
  return fetchRumahOTP(`/api/v2/countries?service_id=${service_id}`);
}

// ─── Operators ──────────────────────────────────────────────────────────────
export async function getOperators(country, provider_id) {
  return fetchRumahOTP(`/api/v2/operators?country=${encodeURIComponent(country)}&provider_id=${provider_id}`);
}

// ─── Orders ─────────────────────────────────────────────────────────────────
export async function createOrder(number_id, provider_id, operator_id) {
  return fetchRumahOTP(`/api/v2/orders?number_id=${number_id}&provider_id=${provider_id}&operator_id=${operator_id}`);
}

export async function getOrderStatus(order_id) {
  return fetchRumahOTP(`/api/v1/orders/get_status?order_id=${order_id}`);
}

export async function setOrderStatus(order_id, status) {
  return fetchRumahOTP(`/api/v1/orders/set_status?order_id=${order_id}&status=${status}`);
}

// ─── User Balance (Provider) ─────────────────────────────────────────────────
export async function getProviderBalance() {
  return fetchRumahOTP('/api/v1/user/balance');
}

// ─── Deposit ─────────────────────────────────────────────────────────────────
export async function createDeposit(amount) {
  return fetchRumahOTP(`/api/v1/deposit/create?amount=${amount}&payment_id=qris`);
}

export async function getDepositStatus(deposit_id) {
  return fetchRumahOTP(`/api/v2/deposit/get_status?deposit_id=${deposit_id}`);
}

export async function cancelDeposit(deposit_id) {
  return fetchRumahOTP(`/api/v1/deposit/cancel?deposit_id=${deposit_id}`);
}
