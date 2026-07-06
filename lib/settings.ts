// User-tunable play criteria, persisted to localStorage (no backend).

export type TempUnit = "F" | "C";
export type WindUnit = "mph" | "kmh";

export interface Settings {
  weekdayStart: number; // hour, 24h (window is [start, end))
  weekdayEnd: number;
  weekendStart: number;
  weekendEnd: number;
  windLimit: number; // in windUnit
  tempMin: number; // in tempUnit
  tempMax: number;
  requireDaylight: boolean; // only count daylight hours as playable
  tempUnit: TempUnit;
  windUnit: WindUnit;
  onlyGreen: boolean; // dim non-playable days
}

export const DEFAULT_SETTINGS: Settings = {
  weekdayStart: 17,
  weekdayEnd: 21,
  weekendStart: 14,
  weekendEnd: 21,
  windLimit: 20,
  tempMin: 50,
  tempMax: 95,
  requireDaylight: true,
  tempUnit: "F",
  windUnit: "mph",
  onlyGreen: false,
};

const KEY = "vb-settings";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

// Convert default Fahrenheit temp bounds when the user flips units, so the
// numbers stay sensible instead of literal (e.g. 50°F -> 10°C).
export function convertTemp(v: number, from: TempUnit, to: TempUnit): number {
  if (from === to) return v;
  return to === "C" ? Math.round(((v - 32) * 5) / 9) : Math.round((v * 9) / 5 + 32);
}

export function convertWind(v: number, from: WindUnit, to: WindUnit): number {
  if (from === to) return v;
  return to === "kmh" ? Math.round(v * 1.609) : Math.round(v / 1.609);
}

// 12h label for an hour, e.g. 17 -> "5 PM".
export function hourLabel(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}
