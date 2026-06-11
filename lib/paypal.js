// PayPal server-side helpers — env vars, access token caching, base URL.
// NEVER import from a client component (handles CLIENT_SECRET).

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

export function getPayPalEnv() {
  const env = process.env.PAYPAL_ENV;
  if (env !== "sandbox" && env !== "live") {
    throw new Error(
      `PAYPAL_ENV must be 'sandbox' or 'live' (got: ${env || "(unset)"})`
    );
  }
  return env;
}

export function getPayPalBaseUrl() {
  return getPayPalEnv() === "live" ? LIVE_BASE : SANDBOX_BASE;
}

export function getPayPalClientId() {
  const id = process.env.PAYPAL_CLIENT_ID;
  if (!id) throw new Error("PAYPAL_CLIENT_ID is not set");
  return id;
}

function getPayPalClientSecret() {
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!secret) throw new Error("PAYPAL_CLIENT_SECRET is not set");
  return secret;
}

// Token cache (per-process). PayPal access tokens last ~9 hours. We refresh
// when fewer than 5 minutes remain.
let _cachedToken = null;
let _cachedTokenExpiresAt = 0;

export async function getPayPalAccessToken() {
  const now = Date.now();
  if (_cachedToken && _cachedTokenExpiresAt - now > 5 * 60 * 1000) {
    return _cachedToken;
  }
  const id = getPayPalClientId();
  const secret = getPayPalClientSecret();
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  const res = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token request failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  _cachedToken = data.access_token;
  _cachedTokenExpiresAt = now + (data.expires_in || 32400) * 1000;
  return _cachedToken;
}

/**
 * Call a PayPal REST endpoint with auth + JSON parsing.
 * Returns the parsed body on success; throws on non-2xx with the response body
 * embedded in the message.
 */
export async function paypalRequest(path, { method = "GET", body } = {}) {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${getPayPalBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const parsed = text ? safeJsonParse(text) : null;
  if (!res.ok) {
    const message = parsed?.message || parsed?.details?.[0]?.description || text;
    const error = new Error(`PayPal ${method} ${path} failed (${res.status}): ${message}`);
    // Surface the parsed body + the canonical issue code so callers can
    // branch on declined-card vs payer-action-needed vs system error.
    error.paypalStatus = res.status;
    error.paypalBody = parsed;
    error.paypalIssue = parsed?.details?.[0]?.issue || null;
    throw error;
  }
  return parsed;
}

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}
