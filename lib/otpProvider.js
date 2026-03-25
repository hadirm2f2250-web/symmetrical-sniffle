/**
 * JasaOTP Multi-Server Provider
 * Server 3: https://api.jasaotp.id/v1/
 * Server 4: https://api.jasaotp.id/v2/
 */

const SERVERS = {
  server3: 'https://api.jasaotp.id/v1',
  server4: 'https://api.jasaotp.id/v2',
};

const SERVER_LABELS = {
  server3: 'Server 3',
  server4: 'Server 4',
};

const API_KEY = process.env.JASAOTP_API_KEY;

function getBaseUrl(server) {
  return SERVERS[server] || SERVERS.server3;
}

// ─── Rate Limiter: max 5 requests per 10 seconds (sliding window) ────────────
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

async function fetchAPI(path, server = 'server3') {
  await waitForSlot();
  const base = getBaseUrl(server);
  const url = `${base}${path}`;
  console.log(`[JasaOTP ${SERVER_LABELS[server] || server}]`, url);
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
  if (!res.ok || !json.success) {
    // layanan.php returns non-standard format (no success field), handle separately
    if (!res.ok) console.error(`[JasaOTP Error]`, path, res.status, JSON.stringify(json));
  }
  return json;
}

// ─── Negara (Countries) ─────────────────────────────────────────────────────
export async function getCountries(server = 'server3') {
  const result = await fetchAPI('/negara.php', server);
  if (!result.success) return { success: false, data: [] };
  return {
    success: true,
    data: result.data.map(n => ({
      id: n.id_negara,
      name: n.nama_negara,
    })),
  };
}

// ─── Layanan (Services per Country) ─────────────────────────────────────────
export async function getServices(countryId, server = 'server3') {
  const result = await fetchAPI(`/layanan.php?negara=${countryId}`, server);
  // Response: { "6": { "wa": { harga, stok, layanan }, ... } }
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

// ─── Operators ──────────────────────────────────────────────────────────────
export async function getOperators(countryId, server = 'server3') {
  const result = await fetchAPI(`/operator.php?negara=${countryId}`, server);
  if (!result.success) return { success: false, data: [] };
  
  const ops = result.data[String(countryId)];
  if (!ops || !Array.isArray(ops)) return { success: true, data: [] };
  
  return {
    success: true,
    data: ops.map(name => ({ id: name, name })),
  };
}

// ─── Create Order ───────────────────────────────────────────────────────────
export async function createOrder(countryId, serviceCode, operator, server = 'server3') {
  const result = await fetchAPI(
    `/order.php?api_key=${API_KEY}&negara=${countryId}&layanan=${encodeURIComponent(serviceCode)}&operator=${encodeURIComponent(operator)}`,
    server
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

// ─── Check OTP (SMS) ────────────────────────────────────────────────────────
const WAITING_PLACEHOLDERS = ['menunggu', 'waiting', 'pending', '-', ''];

export async function getOrderStatus(orderId, server = 'server3') {
  const result = await fetchAPI(`/sms.php?api_key=${API_KEY}&id=${orderId}`, server);
  console.log(`[JasaOTP sms.php response] order=${orderId}`, JSON.stringify(result));
  
  // Cek apakah OTP benar-benar ada (bukan placeholder "Menunggu" dll)
  const otp = result?.data?.otp;
  const isRealOtp = otp && !WAITING_PLACEHOLDERS.includes(String(otp).trim().toLowerCase());
  
  if (result.success && isRealOtp) {
    return {
      success: true,
      data: {
        status: 'received',
        otp_code: String(otp),
      },
    };
  }
  
  // OTP belum masuk — tetap waiting
  return {
    success: true,
    data: { status: 'waiting', otp_code: '-' },
  };
}

// ─── Cancel Order ───────────────────────────────────────────────────────────
export async function cancelOrder(orderId, server = 'server3') {
  const result = await fetchAPI(`/cancel.php?api_key=${API_KEY}&id=${orderId}`, server);
  if (!result.success) {
    let msg = result.message || 'Gagal membatalkan order';
    // Parse EARLY_CANCEL_DENIED error
    if (typeof msg === 'string' && msg.includes('EARLY_CANCEL_DENIED')) {
      msg = 'Pesanan belum bisa dibatalkan. Tunggu minimal 2 menit setelah order baru bisa cancel.';
    }
    return { success: false, message: msg };
  }
  return {
    success: true,
    data: {
      order_id: result.data.order_id,
      refunded_amount: result.data.refunded_amount,
    },
  };
}

// ─── Provider Balance (Admin only) ──────────────────────────────────────────
export async function getProviderBalance(server = 'server3') {
  const result = await fetchAPI(`/balance.php?api_key=${API_KEY}`, server);
  if (!result.success) {
    return { success: false, data: null };
  }
  return {
    success: true,
    data: {
      balance: result.data.saldo,
      formated: `Rp${Number(result.data.saldo).toLocaleString('id-ID')}`,
      username: 'JasaOTP',
      email: SERVER_LABELS[server] || server,
    },
  };
}
