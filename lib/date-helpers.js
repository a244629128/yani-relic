// ET-aware date helpers (no external library). Used by the analytics
// calendar heatmap to bucket events by America/New_York calendar date
// regardless of where Vercel's server clock is running (UTC).

const ET = "America/New_York";

/**
 * Returns the local-date string (YYYY-MM-DD) of a UTC timestamp in the
 * given timezone. Handles DST automatically via Intl.
 */
export function localDateString(timestamp, tz = ET) {
  // en-CA gives ISO-like YYYY-MM-DD order via the locale's default format.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

/**
 * Returns a Date object representing midnight on (year-month-1) in ET as
 * a UTC instant. Critical for SQL range queries — Codex HIGH finding:
 * naive `new Date(year, month, 1)` uses the server's local timezone
 * (Vercel = UTC), not ET, so events near month boundaries would land
 * in the wrong calendar.
 *
 * Strategy: ET is UTC-4 (EDT) or UTC-5 (EST). Try both candidate UTC
 * instants and pick the one whose ET format = day '01' hour '00'.
 *
 * @param {number} year   1-indexed (e.g. 2026)
 * @param {number} month  1-indexed (1=Jan, 12=Dec)
 * @returns {Date}
 */
export function etMonthStartUtc(year, month) {
  for (const offsetHours of [4, 5]) {
    const candidate = new Date(
      Date.UTC(year, month - 1, 1, offsetHours, 0, 0, 0)
    );
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: ET,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(candidate);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    if (get("day") === "01" && get("hour") === "00" && get("minute") === "00") {
      return candidate;
    }
  }
  // Codex MED: silent fallback would have skewed analytics quietly. If
  // neither UTC-4 nor UTC-5 produces a clean ET midnight, throw and let
  // the admin page surface the issue rather than under-/over-count.
  throw new Error(
    `Could not compute ET month start for ${year}-${month}: neither UTC-4 nor UTC-5 candidate matched`
  );
}

/**
 * Returns the start of the next month in ET (i.e. the exclusive upper
 * bound for the current month's query).
 */
export function etNextMonthStartUtc(year, month) {
  return month === 12
    ? etMonthStartUtc(year + 1, 1)
    : etMonthStartUtc(year, month + 1);
}

/**
 * Returns the ET calendar date as YYYY-MM-DD for "now."
 */
export function etTodayString() {
  return localDateString(Date.now(), ET);
}

/**
 * Given a YYYY-MM string, returns { year, month } as 1-indexed numbers.
 * If invalid, returns the current ET month.
 */
export function parseMonthParam(input) {
  if (typeof input === "string") {
    const m = input.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if (m) return { year: Number(m[1]), month: Number(m[2]) };
  }
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return {
    year: Number(todayParts.find((p) => p.type === "year").value),
    month: Number(todayParts.find((p) => p.type === "month").value),
  };
}

/**
 * Returns the number of days in the (year, month) Gregorian calendar.
 * 1-indexed month (Jan=1).
 */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Returns the weekday index (0=Sun..6=Sat) of the first day of the ET
 * month — used for grid leading-blank calculation.
 */
export function firstWeekdayOfMonth(year, month) {
  const utcMid = etMonthStartUtc(year, month);
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "short",
  }).format(utcMid);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayName);
}

/**
 * Format a YYYY-MM-DD string into something like "Jun 11" for display.
 */
export function shortDateLabel(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Format a (year, month) pair into "June 2026."
 */
export function monthLabel(year, month) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}
