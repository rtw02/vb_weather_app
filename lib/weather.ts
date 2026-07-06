// Open-Meteo forecast fetch + stoplight classification.
// No API key required; CORS-enabled so we call it straight from the browser.
//
// Split in two: fetchRaw() gets (and caches) the raw hourly series keyed by
// coords + units; classifyDays() turns it into stoplight days using the user's
// Settings. This lets settings changes (window, temp, wind, daylight) reclassify
// instantly with no refetch — only a units change re-hits the network.

import type { Settings } from "./settings";

export type DayColor = "green" | "yellow" | "red";

export interface HourWeather {
  hour: number; // local hour of day (e.g. 17)
  wind: number; // in windUnit
  precip: number; // mm
  temp: number; // in tempUnit
  isDay: boolean;
  good: boolean;
}

export interface DayWeather {
  iso: string; // YYYY-MM-DD (local to the location)
  color: DayColor;
  goodHours: number;
  totalHours: number;
  maxWind: number;
  rainyHours: number;
  loTemp: number;
  hiTemp: number;
  hours: HourWeather[];
}

export interface RawHourly {
  time: string[];
  precipitation: number[];
  windspeed_10m: number[];
  temperature_2m: number[];
  is_day: number[];
}

function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

function windowHours(iso: string, s: Settings): number[] {
  const [start, end] = isWeekend(iso)
    ? [s.weekendStart, s.weekendEnd]
    : [s.weekdayStart, s.weekdayEnd];
  const hours: number[] = [];
  for (let h = start; h < end; h++) hours.push(h);
  return hours;
}

// Majority-rules coloring on the share of good hours in the window.
function colorFor(ratio: number): DayColor {
  if (ratio >= 0.67) return "green";
  if (ratio >= 0.34) return "yellow";
  return "red";
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — forecast barely moves within the window

function readCache(key: string): RawHourly | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const { t, hourly } = JSON.parse(raw) as { t: number; hourly: RawHourly };
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return hourly;
  } catch {
    return null;
  }
}

function writeCache(key: string, hourly: RawHourly): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), hourly }));
  } catch {
    /* quota / disabled storage — ignore */
  }
}

// Fetch the raw hourly series (cached per coords + units).
export async function fetchRaw(
  lat: number,
  lon: number,
  tempUnit: "F" | "C",
  windUnit: "mph" | "kmh"
): Promise<RawHourly> {
  const key = `vb-raw:${lat.toFixed(2)},${lon.toFixed(2)},${tempUnit},${windUnit}`;
  const cached = readCache(key);
  if (cached) return cached;

  const tu = tempUnit === "C" ? "celsius" : "fahrenheit";
  const wu = windUnit === "kmh" ? "kmh" : "mph";
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=precipitation,windspeed_10m,temperature_2m,is_day` +
    `&temperature_unit=${tu}&windspeed_unit=${wu}` +
    `&forecast_days=16&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const data = (await res.json()) as { hourly: RawHourly };
  writeCache(key, data.hourly);
  return data.hourly;
}

export function classifyDays(
  hourly: RawHourly,
  s: Settings
): Map<string, DayWeather> {
  const byDay = new Map<string, HourWeather[]>();

  for (let i = 0; i < hourly.time.length; i++) {
    const [iso, hm] = hourly.time[i].split("T");
    const hour = parseInt(hm.slice(0, 2), 10);
    if (!windowHours(iso, s).includes(hour)) continue;

    const precip = hourly.precipitation[i] ?? 0;
    const wind = hourly.windspeed_10m[i] ?? 0;
    const temp = hourly.temperature_2m[i] ?? 0;
    const isDay = (hourly.is_day[i] ?? 1) === 1;

    const good =
      precip === 0 &&
      wind < s.windLimit &&
      temp >= s.tempMin &&
      temp <= s.tempMax &&
      (!s.requireDaylight || isDay);

    const list = byDay.get(iso) ?? [];
    list.push({ hour, wind: Math.round(wind), precip, temp: Math.round(temp), isDay, good });
    byDay.set(iso, list);
  }

  const result = new Map<string, DayWeather>();
  for (const [iso, hours] of byDay) {
    if (hours.length === 0) continue;
    const good = hours.filter((h) => h.good).length;
    const temps = hours.map((h) => h.temp);
    result.set(iso, {
      iso,
      color: colorFor(good / hours.length),
      goodHours: good,
      totalHours: hours.length,
      maxWind: Math.max(...hours.map((h) => h.wind)),
      rainyHours: hours.filter((h) => h.precip > 0).length,
      loTemp: Math.min(...temps),
      hiTemp: Math.max(...temps),
      hours,
    });
  }
  return result;
}
