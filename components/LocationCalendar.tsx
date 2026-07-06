"use client";

import { useEffect, useMemo, useState } from "react";
import type { SavedLocation } from "@/lib/locations";
import { buildWeeks } from "@/lib/calendar";
import { fetchRaw, classifyDays, type DayWeather } from "@/lib/weather";
import { hourLabel, type Settings } from "@/lib/settings";
import {
  bestDay,
  greenStreak,
  nextSession,
  shareText,
  todayMood,
  type Mood,
} from "@/lib/funstats";
import { googleCalendarUrl, downloadIcs } from "@/lib/ics";
import CalendarGrid from "./CalendarGrid";

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

const COLOR_LABEL: Record<string, string> = {
  green: "All good 🟢",
  yellow: "Mixed 🟡",
  red: "Mostly bad 🔴",
};

export default function LocationCalendar({
  location,
  settings,
  onRemove,
  onMood,
  onBest,
}: {
  location: SavedLocation;
  settings: Settings;
  onRemove: (id: string) => void;
  onMood?: (mood: Mood) => void;
  onBest?: (id: string, label: string, best: DayWeather | null) => void;
}) {
  const [raw, setRaw] = useState<Awaited<ReturnType<typeof fetchRaw>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [shared, setShared] = useState(false);

  const weeks = useMemo(() => buildWeeks(new Date()), []);

  // Reclassify instantly whenever settings change — no refetch.
  const forecast = useMemo(
    () => (raw ? classifyDays(raw, settings) : new Map<string, DayWeather>()),
    [raw, settings]
  );

  const best = useMemo(() => bestDay(forecast), [forecast]);
  const streak = useMemo(() => greenStreak(forecast), [forecast]);
  const next = useMemo(() => nextSession(forecast), [forecast]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (forecast.size > 0) onMood?.(todayMood(forecast));
  }, [forecast, onMood]);

  useEffect(() => {
    onBest?.(location.id, location.label, best);
  }, [best, location.id, location.label, onBest]);

  // Refetch only when coords or units change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRaw(location.lat, location.lon, settings.tempUnit, settings.windUnit)
      .then((r) => {
        if (!cancelled) setRaw(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Failed to load weather");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location.lat, location.lon, settings.tempUnit, settings.windUnit]);

  async function handleShare() {
    const text = shareText(location.label, forecast);
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* cancelled */
    }
  }

  const detail = selected ? forecast.get(selected) : undefined;
  const goodHoursOf = detail?.hours.filter((h) => h.good) ?? [];
  const canSchedule = goodHoursOf.length > 0;
  const startHour = canSchedule ? goodHoursOf[0].hour : 0;
  const endHour = canSchedule ? goodHoursOf[goodHoursOf.length - 1].hour + 1 : 0;

  function reasonEmoji(h: (typeof goodHoursOf)[number]): string {
    if (h.good) return "✅";
    if (h.precip > 0) return "🌧️";
    if (h.wind >= settings.windLimit) return "💨";
    if (settings.requireDaylight && !h.isDay) return "🌙";
    return "🌡️"; // temperature out of range
  }

  return (
    <section className="animate-fade-in-up rounded-2xl border border-white/70 bg-white/55 p-4 shadow-lg shadow-sky-900/5 backdrop-blur-md transition-colors hover:border-white">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <span className="text-sky-600">📍</span>
          {location.label}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex min-h-[44px] items-center rounded-md px-3 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {shared ? "Copied ✓" : "Share"}
          </button>
          <button
            type="button"
            onClick={() => onRemove(location.id)}
            aria-label={`Remove ${location.label}`}
            className="inline-flex min-h-[44px] items-center rounded-md px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-500/15 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            Remove
          </button>
        </div>
      </div>

      {!loading && !error && (best || streak > 0 || next) && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {streak > 0 && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 font-medium text-emerald-700">
              🔥 {streak}-day green streak
            </span>
          )}
          {next && (
            <span className="rounded-full bg-sky-500/15 px-2 py-1 font-medium text-sky-700 tabular-nums">
              ⏱️ next session in {formatCountdown(next.getTime() - now)}
            </span>
          )}
          {best && (
            <span className="rounded-full bg-amber-400/20 px-2 py-1 font-medium text-amber-700">
              🏆 best: {best.iso.slice(5)}
            </span>
          )}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 21 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square animate-shimmer rounded-lg" />
          ))}
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!loading && !error && (
        <>
          <CalendarGrid
            weeks={weeks}
            forecast={forecast}
            selected={selected}
            bestIso={best?.iso ?? null}
            onlyGreen={settings.onlyGreen}
            onSelect={(iso) => setSelected((s) => (s === iso ? null : iso))}
          />

          {detail && (
            <div className="mt-3 animate-slide-down rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 text-sm shadow-inner">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  {prettyDate(detail.iso)} — {COLOR_LABEL[detail.color]}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded px-1.5 text-xs text-slate-400 hover:text-slate-700"
                  aria-label="Close details"
                >
                  ✕
                </button>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Playable {detail.goodHours}/{detail.totalHours} hrs · {detail.rainyHours} rainy ·
                wind ≤ {detail.maxWind} {settings.windUnit} · {detail.loTemp}–{detail.hiTemp}°
                {settings.tempUnit}
              </p>

              {canSchedule && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={googleCalendarUrl(location.label, detail.iso, startHour, endHour)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center rounded-md bg-sky-600 px-3 text-xs font-medium text-white hover:bg-sky-500"
                  >
                    📅 Google Calendar
                  </a>
                  <button
                    type="button"
                    onClick={() => downloadIcs(location.label, detail.iso, startHour, endHour)}
                    className="inline-flex min-h-[36px] items-center rounded-md bg-white px-3 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                  >
                    ⬇︎ .ics
                  </button>
                </div>
              )}

              <table className="mt-2 w-full text-xs tabular-nums">
                <thead className="text-slate-400">
                  <tr className="text-left">
                    <th className="font-normal">Time</th>
                    <th className="font-normal">Temp</th>
                    <th className="font-normal">Rain</th>
                    <th className="font-normal">Wind</th>
                    <th className="font-normal text-right">Play?</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.hours.map((h) => (
                    <tr key={h.hour} className="border-t border-amber-200/60">
                      <td className="py-1 font-medium text-slate-700">{hourLabel(h.hour)}</td>
                      <td className="text-slate-600">{h.temp}°</td>
                      <td className="text-slate-600">{h.precip > 0 ? `${h.precip} mm` : "—"}</td>
                      <td className="text-slate-600">{h.wind}</td>
                      <td className="py-1 text-right">{reasonEmoji(h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[11px] text-slate-400">
                ✅ playable · 🌧️ rain · 💨 windy · 🌡️ temp · 🌙 dark
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
