// Open-Meteo forecast fetch + stoplight classification.
// No API key required; CORS-enabled so we call it straight from the browser.

export type DayColor = "green" | "yellow" | "red";

export interface HourWeather {
  hour: number; // local hour of day (e.g. 17)
  wind: number; // mph
  precip: number; // mm
  good: boolean; // dry and wind < limit
}

export interface DayWeather {
  iso: string; // YYYY-MM-DD (local to the location)
  color: DayColor;
  goodHours: number;
  totalHours: number;
  maxWind: number; // mph, over the window
  rainyHours: number; // hours with any precipitation in the window
  hours: HourWeather[]; // per-hour breakdown across the window
}

// Volleyball-playable window, in local hours of the day.
// Weekdays 5-9pm -> hours 17,18,19,20. Weekends 2-9pm -> hours 14..20.
const WEEKDAY_HOURS = [17, 18, 19, 20];
const WEEKEND_HOURS = [14, 15, 16, 17, 18, 19, 20];

const WIND_LIMIT_MPH = 20;

interface OpenMeteoHourly {
  time: string[];
  precipitation: number[];
  windspeed_10m: number[];
}

function windowHoursFor(iso: string): number[] {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun ... 6=Sat
  const isWeekend = dow === 0 || dow === 6;
  return isWeekend ? WEEKEND_HOURS : WEEKDAY_HOURS;
}

// Majority-rules coloring on the share of good hours in the window.
function colorFor(ratio: number): DayColor {
  if (ratio >= 0.67) return "green";
  if (ratio >= 0.34) return "yellow";
  return "red";
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — forecast barely moves within the window

// Read a fresh cached forecast for these coords from sessionStorage, if any.
function readCache(key: string): Map<string, DayWeather> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const { t, entries } = JSON.parse(raw) as {
      t: number;
      entries: [string, DayWeather][];
    };
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return new Map(entries);
  } catch {
    return null;
  }
}

function writeCache(key: string, map: Map<string, DayWeather>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ t: Date.now(), entries: [...map] })
    );
  } catch {
    /* quota / disabled storage — ignore, just skip caching */
  }
}

export async function fetchForecast(
  lat: number,
  lon: number
): Promise<Map<string, DayWeather>> {
  // Round coords so nearby re-adds share a cache entry.
  const cacheKey = `vb-fc:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=precipitation,windspeed_10m` +
    `&windspeed_unit=mph&forecast_days=16&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const data = (await res.json()) as { hourly: OpenMeteoHourly };

  const classified = classifyDays(data.hourly);
  writeCache(cacheKey, classified);
  return classified;
}

export function classifyDays(hourly: OpenMeteoHourly): Map<string, DayWeather> {
  // Collect the relevant in-window hours per local date.
  const byDay = new Map<string, HourWeather[]>();

  for (let i = 0; i < hourly.time.length; i++) {
    const stamp = hourly.time[i]; // e.g. "2026-06-22T17:00"
    const [iso, hm] = stamp.split("T");
    const hour = parseInt(hm.slice(0, 2), 10);

    if (!windowHoursFor(iso).includes(hour)) continue;

    const precip = hourly.precipitation[i] ?? 0;
    const wind = hourly.windspeed_10m[i] ?? 0;

    const list = byDay.get(iso) ?? [];
    list.push({
      hour,
      wind: Math.round(wind),
      precip,
      good: precip === 0 && wind < WIND_LIMIT_MPH,
    });
    byDay.set(iso, list);
  }

  const result = new Map<string, DayWeather>();
  for (const [iso, hours] of byDay) {
    if (hours.length === 0) continue;
    const good = hours.filter((h) => h.good).length;
    result.set(iso, {
      iso,
      color: colorFor(good / hours.length),
      goodHours: good,
      totalHours: hours.length,
      maxWind: Math.max(...hours.map((h) => h.wind)),
      rainyHours: hours.filter((h) => h.precip > 0).length,
      hours,
    });
  }
  return result;
}
