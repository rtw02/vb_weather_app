// Derived "fun" stats from a location's forecast map.

import type { DayWeather } from "./weather";
import { toISO } from "./calendar";

export type Mood = "great" | "clear" | "wind" | "rain";

// Per-day glanceable emoji.
export function dayEmoji(d: DayWeather): string {
  if (d.rainyHours > 0) return "🌧️";
  if (d.maxWind >= 20) return "💨";
  if (d.color === "green") return "☀️";
  return "⛅";
}

// Upcoming days (today onward), in date order.
function upcoming(forecast: Map<string, DayWeather>): DayWeather[] {
  const today = toISO(new Date());
  return [...forecast.values()]
    .filter((d) => d.iso >= today)
    .sort((a, b) => a.iso.localeCompare(b.iso));
}

// Greenest upcoming day (best playable ratio, earliest wins ties).
export function bestDay(forecast: Map<string, DayWeather>): DayWeather | null {
  let best: DayWeather | null = null;
  for (const d of upcoming(forecast)) {
    const ratio = d.goodHours / d.totalHours;
    const bestRatio = best ? best.goodHours / best.totalHours : -1;
    if (ratio > bestRatio) best = d;
  }
  return best;
}

// Consecutive green days starting today.
export function greenStreak(forecast: Map<string, DayWeather>): number {
  let n = 0;
  for (const d of upcoming(forecast)) {
    if (d.color === "green") n++;
    else break;
  }
  return n;
}

// Start time of the next playable session: the first good hour of the next
// upcoming day that has any playable hours.
export function nextSession(forecast: Map<string, DayWeather>): Date | null {
  const now = new Date();
  for (const d of upcoming(forecast)) {
    const good = d.hours.find((h) => h.good);
    if (!good) continue;
    const [y, m, day] = d.iso.split("-").map(Number);
    const start = new Date(y, m - 1, day, good.hour, 0, 0, 0);
    if (start.getTime() > now.getTime()) return start;
  }
  return null;
}

// Mood of today's weather, drives the reactive scene.
export function todayMood(forecast: Map<string, DayWeather>): Mood {
  const today = forecast.get(toISO(new Date()));
  if (!today) return "clear";
  if (today.rainyHours >= 2) return "rain";
  if (today.maxWind >= 20) return "wind";
  if (today.color === "green") return "great";
  return "clear";
}

export function prettyDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// Shareable one-liner for the best upcoming day.
export function shareText(label: string, forecast: Map<string, DayWeather>): string {
  const b = bestDay(forecast);
  if (!b) return `🏐 ${label}: no volleyball forecast yet.`;
  return `🏐 ${label}: best day to play is ${prettyDay(b.iso)} — ${b.goodHours}/${b.totalHours} hrs clear & calm. Game on!`;
}
