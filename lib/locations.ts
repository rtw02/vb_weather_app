// Saved locations, persisted to localStorage (no database).

export interface SavedLocation {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

const KEY = "vb-weather-locations";

export function loadLocations(): SavedLocation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedLocation[]) : [];
  } catch {
    return [];
  }
}

export function saveLocations(list: SavedLocation[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}
