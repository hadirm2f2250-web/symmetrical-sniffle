const RUMAHOTP_BASE = 'https://www.rumahotp.com';
const API_KEY = process.env.RUMAHOTP_API_KEY;

const headers = {
  'x-apikey': API_KEY,
  'Accept': 'application/json',
};

async function fetchRumahOTP(path) {
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
