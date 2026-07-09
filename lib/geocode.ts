// Place/POI search via Photon (OpenStreetMap). Free, no API key, CORS-enabled.
// Finds named parks and courts as well as cities. Data © OpenStreetMap contributors.

export interface GeoResult {
  label: string; // primary name, e.g. "Hudson River Park"
  detail?: string; // locality, e.g. "New York, US"
  lat: number;
  lon: number;
  kind: "park" | "place";
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }; // [lon, lat] — GeoJSON order
  properties: {
    name?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

// Full, human-readable address from most-specific → general, de-duplicated.
function buildAddress(p: PhotonFeature["properties"]): string {
  const locality = p.city ?? p.locality ?? p.district ?? p.county;
  const state = p.postcode ? `${p.state ?? ""} ${p.postcode}`.trim() : p.state;
  const parts = [p.street, locality, state, p.country].filter(Boolean) as string[];
  // Drop consecutive duplicates (e.g. city === county).
  return parts.filter((v, i) => v !== parts[i - 1]).join(", ");
}

const PARK_VALUES = new Set([
  "park",
  "pitch",
  "sports_centre",
  "recreation_ground",
  "beach",
  "garden",
  "stadium",
]);

export async function searchPlaces(
  query: string,
  bias?: { lat: number; lon: number }
): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];

  let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`;
  if (bias) url += `&lat=${bias.lat}&lon=${bias.lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = (await res.json()) as { features?: PhotonFeature[] };

  const seen = new Set<string>();
  const out: GeoResult[] = [];

  for (const f of data.features ?? []) {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates; // GeoJSON: [lon, lat]
    const detail = buildAddress(p);
    const name = p.name ?? p.street ?? detail;
    if (!name) continue;

    const dedupeKey = `${name}|${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const kind =
      p.osm_key === "leisure" || (p.osm_value && PARK_VALUES.has(p.osm_value))
        ? "park"
        : "place";

    out.push({ label: name, detail: detail || undefined, lat, lon, kind });
  }

  return out;
}

// Reverse geocode a dropped pin → nearest named place + full address.
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<GeoResult | null> {
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const f = data.features?.[0];
    if (!f) return null;
    const p = f.properties;
    const detail = buildAddress(p);
    const name = p.name ?? p.street ?? (detail || "Pinned location");
    const kind =
      p.osm_key === "leisure" || (p.osm_value && PARK_VALUES.has(p.osm_value))
        ? "park"
        : "place";
    return { label: name, detail: detail || undefined, lat, lon, kind };
  } catch {
    return null;
  }
}
