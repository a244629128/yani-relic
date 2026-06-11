"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  daysInMonth,
  firstWeekdayOfMonth,
  monthLabel,
  shortDateLabel,
  etTodayString,
} from "@/lib/date-helpers";

// Codex MED #8: build a navigation URL that preserves existing query
// params (e.g. ?days=30) while overriding one key (e.g. ?month=...).
function buildHref(current, key, value) {
  const params = new URLSearchParams(current);
  if (value == null) params.delete(key);
  else params.set(key, String(value));
  const s = params.toString();
  return s ? `?${s}` : "?";
}

// Tab options for the metric switcher above the heatmap. Codex called
// out that "Clicks" was ambiguous — renamed "Intent" to make it clear
// it's Depop + email (combined purchase-intent signal).
const METRICS = [
  { key: "views", label: "Views", color: "labradorite" },
  { key: "visitors", label: "Visitors", color: "labradorite" },
  { key: "intent", label: "Intent", color: "rose" },
  { key: "imageZooms", label: "Fullscreen", color: "labradorite" },
  { key: "flipDeckClaims", label: "Flip deck", color: "labradorite" },
];

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Calendar heatmap on /admin/analytics.
 *
 * Server passes `monthData = { days, monthMax }` for the selected year+month.
 * Client manages: which metric is active (tab strip) and which day is open
 * (inline drill-down panel below the grid). Month navigation is via
 * <Link href="?month=YYYY-MM"> — server re-renders with new data.
 *
 * Heat scaling per Codex MED: sqrt(value / monthMax) instead of linear so
 * lower-traffic days stay visible alongside the occasional TikTok spike.
 */
export default function CalendarHeatmap({ year, month, monthData }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [metric, setMetric] = useState("views");
  const searchParams = useSearchParams();

  const days = monthData?.days || {};
  const monthMax = monthData?.monthMax || {};
  const todayStr = etTodayString();

  const numDays = daysInMonth(year, month);
  const firstWeekday = firstWeekdayOfMonth(year, month);

  // Build the grid: leading blanks + month days + trailing blanks to fill
  // the last row. Lead/trail cells aren't interactive (per Codex LOW #8).
  const cells = useMemo(() => {
    const out = [];
    for (let i = 0; i < firstWeekday; i++) out.push({ kind: "blank" });
    for (let d = 1; d <= numDays; d++) {
      const yyyyMmDd = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const data = days[yyyyMmDd];
      const isFuture = yyyyMmDd > todayStr;
      out.push({
        kind: "day",
        day: d,
        dateStr: yyyyMmDd,
        data,
        isFuture,
        isToday: yyyyMmDd === todayStr,
      });
    }
    while (out.length % 7 !== 0) out.push({ kind: "blank" });
    return out;
  }, [year, month, numDays, firstWeekday, days, todayStr]);

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  const selected = selectedDay ? days[selectedDay] : null;
  const activeMetric = METRICS.find((m) => m.key === metric) || METRICS[0];
  const activeMax = monthMax[activeMetric.key] || 0;

  return (
    <section className="mb-10">
      <h2 className="text-cream font-chancery text-2xl mb-3">Daily activity</h2>

      {/* Calendar widget — constrained width so cells stay compact;
          drill-down panel below opens to full section width. */}
      <div className="max-w-md">

      {/* Month nav */}
      <div className="flex items-center justify-between mb-3 bg-forest/40 border border-parchment/15 rounded-md px-3 py-2">
        <Link
          href={buildHref(
            searchParams,
            "month",
            `${prevMonth.y}-${String(prevMonth.m).padStart(2, "0")}`
          )}
          className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light"
          aria-label="Previous month"
        >
          ← {monthLabel(prevMonth.y, prevMonth.m)}
        </Link>
        <span className="font-chancery text-cream text-lg">
          {monthLabel(year, month)}
        </span>
        <Link
          href={buildHref(
            searchParams,
            "month",
            `${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}`
          )}
          className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light"
          aria-label="Next month"
        >
          {monthLabel(nextMonth.y, nextMonth.m)} →
        </Link>
      </div>

      {/* Metric tabs */}
      <div className="flex flex-wrap gap-1 mb-3">
        {METRICS.map((m) => {
          const active = metric === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? m.color === "rose"
                    ? "bg-rose-700/40 text-rose-100 border-rose-300/40"
                    : "bg-labradorite/40 text-cream border-labradorite-light/40"
                  : "border-brass/30 text-cream-dim hover:border-labradorite-light/40 hover:text-cream"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={i}
            className="text-xs uppercase tracking-[0.18em] text-cream-dim/60"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (cell.kind === "blank") {
            return <div key={i} className="aspect-square" />;
          }
          const count = cell.data?.[activeMetric.key] || 0;
          // sqrt scaling per Codex MED — keeps low values visible.
          const ratio = activeMax > 0 ? Math.sqrt(count / activeMax) : 0;
          // Cap min visible heat so a 1-event day still tints faintly.
          const opacity = count > 0 ? Math.max(0.15, ratio) : 0;
          const baseColor =
            activeMetric.color === "rose"
              ? `rgba(244, 63, 94, ${opacity})` // rose-500
              : `rgba(63, 143, 145, ${opacity})`; // labradorite
          const isSelected = selectedDay === cell.dateStr;
          const disabled = cell.isFuture;
          return (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && setSelectedDay(isSelected ? null : cell.dateStr)}
              disabled={disabled}
              aria-label={`${shortDateLabel(cell.dateStr)} — ${count} ${activeMetric.label.toLowerCase()}`}
              aria-pressed={isSelected}
              className={`relative aspect-square rounded-sm border transition-all flex flex-col items-center justify-center px-1 ${
                disabled
                  ? "border-parchment/5 text-cream-dim/30 cursor-not-allowed"
                  : isSelected
                  ? "border-labradorite-light bg-labradorite/20 ring-1 ring-labradorite-light"
                  : "border-parchment/10 hover:border-parchment/30 cursor-pointer"
              } ${cell.isToday ? "ring-1 ring-brass/60" : ""}`}
              style={!disabled ? { backgroundColor: baseColor } : undefined}
            >
              <span
                className={`text-base font-medium leading-none ${
                  disabled ? "text-cream-dim/30" : "text-cream"
                }`}
              >
                {cell.day}
              </span>
              {count > 0 && (
                <span
                  className={`text-xs tabular-nums leading-none mt-0.5 ${
                    disabled ? "text-cream-dim/30" : "text-cream/85"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      </div>
      {/* Inline drill-down panel — full section width below the constrained calendar */}
      {selectedDay && selected && (
        <DayDrillDown date={selectedDay} data={selected} metric={metric} />
      )}
      {selectedDay && !selected && (
        <div className="mt-4 bg-forest/40 border border-parchment/15 rounded-md p-4 text-center text-cream-dim italic text-sm">
          No events on {shortDateLabel(selectedDay)}.
        </div>
      )}
    </section>
  );
}

function DayDrillDown({ date, data, metric }) {
  // Codex MED #7: re-sort perRelic by the active metric so the user's
  // chosen lens (Views / Intent / Flip deck / etc.) is what drives the
  // row ordering. Falls back to views for stability.
  const sortKey =
    metric === "visitors"
      ? "views" // visitors aren't tracked per-relic — fall back
      : metric;
  const perRelic = useMemo(() => {
    const arr = [...(data.perRelic || [])];
    arr.sort(
      (a, b) =>
        (b[sortKey] || 0) - (a[sortKey] || 0) ||
        (b.views || 0) - (a.views || 0)
    );
    return arr;
  }, [data.perRelic, sortKey]);
  return <DayDrillDownInner date={date} data={data} perRelic={perRelic} />;
}

function DayDrillDownInner({ date, data, perRelic }) {
  return (
    <div className="mt-4 bg-forest/40 border border-parchment/15 rounded-md p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h3 className="font-chancery text-cream text-xl">
          {shortDateLabel(date)}
        </h3>
        <div className="flex flex-wrap gap-3 text-[11px] text-cream-dim">
          <span>
            <span className="text-cream">{data.views}</span> views
          </span>
          <span>
            <span className="text-cream">{data.visitors}</span> visitors
          </span>
          <span className="text-rose-300">
            <span className="text-rose-200">{data.intent}</span> intent
          </span>
          <span>
            <span className="text-cream">{data.imageZooms}</span> fullscreen
          </span>
          <span>
            <span className="text-cream">{data.flipDeckClaims}</span> flip-deck
          </span>
        </div>
      </div>

      {perRelic.length === 0 ? (
        <p className="text-cream-dim/70 italic text-sm">
          Activity wasn&apos;t tied to specific relics this day.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-cream-dim/80">
              <tr>
                <th className="text-left px-2 py-1 font-normal">Relic</th>
                <th className="text-right px-2 py-1 font-normal">Views</th>
                <th className="text-right px-2 py-1 font-normal">Depop</th>
                <th className="text-right px-2 py-1 font-normal">Email</th>
                <th className="text-right px-2 py-1 font-normal">Fullscreen</th>
                <th className="text-right px-2 py-1 font-normal">Flip deck</th>
              </tr>
            </thead>
            <tbody>
              {perRelic.map((r) => (
                <tr key={r.id} className="border-t border-parchment/10">
                  <td className="px-2 py-1.5 text-cream">{r.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-cream-dim">{r.views || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-cream-dim">{r.depopClicks || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-cream-dim">{r.mailtoClicks || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-cream-dim">{r.imageZooms || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-cream-dim">{r.flipDeckClaims || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
