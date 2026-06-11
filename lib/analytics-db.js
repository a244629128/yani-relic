// Server-side aggregation queries for the admin analytics dashboard.
//
// All reads use the service-role client because RLS denies SELECT to the
// anon role. Never import this from a client component.

import { createAdminSupabase } from "@/lib/supabase";
import { getProducts } from "@/lib/products-db";

const DAYS = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

/**
 * Aggregated stats per product, for a given window (default 30 days).
 * Returns one row per known product, ordered by view count descending.
 * Products with no activity in the window get zeros (so admin sees the
 * whole catalog at a glance).
 */
export async function getProductStats({ days = 30 } = {}) {
  const sb = createAdminSupabase();
  const since = DAYS(days);

  const { data: events, error } = await sb
    .from("product_events")
    .select("product_id, event_type, duration_ms, session_id")
    .gte("created_at", since);

  if (error) {
    console.error("getProductStats error:", error);
    return {
      stats: [],
      totals: {
        views: 0,
        depopClicksPerProduct: 0,
        depopClicksGeneral: 0,
        depopClicksAll: 0,
        mailtoClicksPerProduct: 0,
        mailtoClicksGeneral: 0,
        mailtoClicksAll: 0,
        imageZooms: 0,
        uniqueVisitors: 0,
      },
    };
  }

  const products = await getProducts();
  const byId = new Map(
    products.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        price: p.price,
        sold: p.sold,
        views: 0,
        durationsMs: [],
        depopClicks: 0,
        mailtoClicks: 0,
        imageZooms: 0,
      },
    ])
  );

  const allSessions = new Set();
  let totalDepopClicksPerProduct = 0;
  let totalDepopClicksGeneral = 0;
  let totalMailtoPerProduct = 0;
  let totalMailtoGeneral = 0;
  let totalImageZooms = 0;

  for (const ev of events || []) {
    if (ev.session_id) allSessions.add(ev.session_id);
    if (ev.event_type === "depop_click_general") {
      totalDepopClicksGeneral += 1;
      continue;
    }
    if (ev.event_type === "mailto_click_general") {
      totalMailtoGeneral += 1;
      continue;
    }
    const row = byId.get(ev.product_id);
    if (!row) continue;
    if (ev.event_type === "view") {
      row.views += 1;
      if (typeof ev.duration_ms === "number") row.durationsMs.push(ev.duration_ms);
    } else if (ev.event_type === "depop_click") {
      row.depopClicks += 1;
      totalDepopClicksPerProduct += 1;
    } else if (ev.event_type === "mailto_click") {
      row.mailtoClicks += 1;
      totalMailtoPerProduct += 1;
    } else if (ev.event_type === "image_zoom") {
      row.imageZooms += 1;
      totalImageZooms += 1;
    }
  }

  const stats = Array.from(byId.values()).map((r) => {
    const avgMs =
      r.durationsMs.length > 0
        ? r.durationsMs.reduce((a, b) => a + b, 0) / r.durationsMs.length
        : 0;
    const depopCtr = r.views > 0 ? r.depopClicks / r.views : 0;
    // "Intent CTR" combines both purchase-intent signals — Depop OR email.
    const intentCtr = r.views > 0 ? (r.depopClicks + r.mailtoClicks) / r.views : 0;
    return {
      id: r.id,
      name: r.name,
      price: r.price,
      sold: r.sold,
      views: r.views,
      avgDwellMs: Math.round(avgMs),
      depopClicks: r.depopClicks,
      mailtoClicks: r.mailtoClicks,
      imageZooms: r.imageZooms,
      depopCtr,
      intentCtr,
    };
  });

  stats.sort((a, b) => b.views - a.views);

  const totals = {
    views: stats.reduce((a, r) => a + r.views, 0),
    depopClicksPerProduct: totalDepopClicksPerProduct,
    depopClicksGeneral: totalDepopClicksGeneral,
    depopClicksAll: totalDepopClicksPerProduct + totalDepopClicksGeneral,
    mailtoClicksPerProduct: totalMailtoPerProduct,
    mailtoClicksGeneral: totalMailtoGeneral,
    mailtoClicksAll: totalMailtoPerProduct + totalMailtoGeneral,
    imageZooms: totalImageZooms,
    uniqueVisitors: allSessions.size,
  };

  return { stats, totals };
}

/**
 * Just the trailing-24-hour event counts. Lightweight; called separately
 * from getProductStats so we can show "hot right now" cheaply.
 */
export async function getRecentActivity({ hours = 24 } = {}) {
  const sb = createAdminSupabase();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("product_events")
    .select("product_id, event_type")
    .gte("created_at", since);

  if (error) {
    console.error("getRecentActivity error:", error);
    return [];
  }

  const counts = new Map();
  for (const ev of data || []) {
    const row = counts.get(ev.product_id) || { product_id: ev.product_id, views: 0, depopClicks: 0 };
    if (ev.event_type === "view") row.views += 1;
    else if (ev.event_type === "depop_click") row.depopClicks += 1;
    counts.set(ev.product_id, row);
  }

  return Array.from(counts.values()).sort((a, b) => b.views - a.views);
}

export function formatDwell(ms) {
  if (!ms || ms < 1000) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export function formatPct(n) {
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
