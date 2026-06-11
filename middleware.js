// middleware.js — runs on every request to /admin/*
// Verifies the signed session cookie. Redirects to /admin/login if missing/invalid.
// Edge runtime — uses Web Crypto + atob/btoa (no Node Buffer).

import { NextResponse } from "next/server";

const COOKIE_NAME = "admin_session";

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
  let s = "";
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifySession(token, secret) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = await hmac(secret, payloadB64);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  try {
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    // base64url → base64 padding
    const padLen = (4 - (padded.length % 4)) % 4;
    const json = atob(padded + "=".repeat(padLen));
    const payload = JSON.parse(json);
    const age = Math.floor(Date.now() / 1000) - (payload.iat || 0);
    if (age > 60 * 60 * 24 * 30 || age < 0) return false;
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  // Only gate /admin paths (excluding /admin/login)
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const valid = await verifySession(token, secret);
  if (!valid) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
