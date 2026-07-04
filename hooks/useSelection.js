"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// Max pieces a buyer can bundle in one checkout. Codex said "cap modestly"
// — 10 is more than enough for a solo-maker jewelry shop, keeps the PayPal
// items[] array clean, and gives us a natural place to reject pathological
// "select everything" attempts.
export const MAX_BUNDLE_SIZE = 10;

const STORAGE_KEY = "yr_selection";
const CHANGE_EVENT = "yr_selection:change";

function safeRead() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: coerce to string, dedupe, cap. Guards against a hand-edited
    // localStorage entry that could otherwise crash render.
    const strings = parsed.filter((v) => typeof v === "string" && v.length > 0);
    return Array.from(new Set(strings)).slice(0, MAX_BUNDLE_SIZE);
  } catch {
    return [];
  }
}

function safeWrite(ids) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage blocked (Safari private mode) — selection is ephemeral
    // for this tab. Not worth crashing over.
  }
  // Notify same-tab subscribers. `storage` events only fire cross-tab, so
  // we manually dispatch a custom event same-tab. Subscribers listen to
  // both; useSyncExternalStore dedupes downstream.
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

// External-store contract for useSyncExternalStore — this is how multiple
// consumers of useSelection (SelectionBar, ProductCard, /checkout page)
// all stay in sync without a context provider.
//
// Codex MED: the storage listener used to be an anonymous arrow. The
// cleanup path passed `handler` to removeEventListener but the anonymous
// wrapper had a different function reference — leak. Both listeners now
// have named references so cleanup actually removes them.
function subscribe(onChange) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  const storageHandler = (e) => {
    // storage event fires cross-tab; filter to our key to avoid needless renders.
    // e.key === null covers localStorage.clear().
    if (e.key === STORAGE_KEY || e.key === null) handler();
  };
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}

// Stable empty array reference. Both getSnapshot (client, fallback on
// storage error) and getServerSnapshot (SSR) return this. React's
// useSyncExternalStore requires stable references to avoid infinite loops.
const EMPTY_IDS = Object.freeze([]);

// The snapshot function must return a *stable* reference between renders
// if the underlying data hasn't changed — otherwise useSyncExternalStore
// loops. We cache the last read as a stringified fingerprint and only
// re-read when localStorage actually changed.
let cachedIds = null;
let cachedFingerprint = null;
function getSnapshot() {
  // Codex MED: localStorage access can throw (private mode, cookies
  // disabled, sandboxed iframes). Wrap defensively — the hook must never
  // crash render.
  let raw = "";
  try {
    if (typeof window !== "undefined") {
      raw = window.localStorage.getItem(STORAGE_KEY) || "";
    }
  } catch {
    return cachedIds || EMPTY_IDS;
  }
  if (raw !== cachedFingerprint) {
    cachedFingerprint = raw;
    cachedIds = safeRead();
  }
  return cachedIds;
}
function getServerSnapshot() {
  return EMPTY_IDS;
}

/**
 * localStorage-backed selection state for the bundle-checkout flow.
 * Multiple components can call this hook in the same render tree; they
 * all read the same underlying array.
 *
 * Returns:
 *   ids           — string[] of selected product IDs
 *   add(id)       — add to selection (no-op if already present or full)
 *   remove(id)    — remove from selection (no-op if absent)
 *   toggle(id)    — flip presence; returns true if added, false if removed
 *   clear()       — empty the selection
 *   has(id)       — boolean
 *   isFull        — true iff selection.length >= MAX_BUNDLE_SIZE
 */
export function useSelection() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((id) => {
    if (!id || typeof id !== "string") return;
    const current = safeRead();
    if (current.includes(id) || current.length >= MAX_BUNDLE_SIZE) return;
    safeWrite([...current, id]);
  }, []);

  const remove = useCallback((id) => {
    if (!id || typeof id !== "string") return;
    const current = safeRead();
    if (!current.includes(id)) return;
    safeWrite(current.filter((x) => x !== id));
  }, []);

  const toggle = useCallback((id) => {
    if (!id || typeof id !== "string") return false;
    const current = safeRead();
    if (current.includes(id)) {
      safeWrite(current.filter((x) => x !== id));
      return false;
    }
    if (current.length >= MAX_BUNDLE_SIZE) return false;
    safeWrite([...current, id]);
    return true;
  }, []);

  const clear = useCallback(() => {
    safeWrite([]);
  }, []);

  const has = useCallback((id) => ids.includes(id), [ids]);
  const isFull = ids.length >= MAX_BUNDLE_SIZE;

  return { ids, add, remove, toggle, clear, has, isFull };
}

// Non-hook helpers for components that only need to check / mutate without
// subscribing to changes (e.g. server-action callers that clear on success).
export function readSelectionOnce() {
  return safeRead();
}
export function clearSelectionOnce() {
  safeWrite([]);
}
