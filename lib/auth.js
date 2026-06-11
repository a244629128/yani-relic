// lib/auth.js
//
// Signed session tokens for the admin cookie. Uses HMAC-SHA256 over a JSON
// payload (timestamp + nonce). Validates signature + expiry. No DB hit.
//
// Note: Edge middleware uses a duplicated minimal version of verifySession
// in middleware.js so it can run without Node Buffer.

import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET missing or too short (need ≥32 chars)");
  }
  return secret;
}

async function hmac(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Buffer.from(sig).toString("base64url");
}

export async function signSession() {
  const payload = JSON.stringify({
    iat: Math.floor(Date.now() / 1000),
    nonce: Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString("base64url"),
  });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = await hmac(getSecret(), payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifySession(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = await hmac(getSecret(), payloadB64);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    const age = Math.floor(Date.now() / 1000) - (payload.iat || 0);
    if (age > COOKIE_MAX_AGE_S || age < 0) return false;
    return true;
  } catch {
    return false;
  }
}

export async function setSessionCookie() {
  const token = await signSession();
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_S,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const valid = await verifySession(token);
  return valid ? { authenticated: true } : null;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
