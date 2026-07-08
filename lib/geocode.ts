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
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
  };
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

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];

  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = (await res.json()) as { features?: PhotonFeature[] };

  const seen = new Set<string>();
  const out: GeoResult[] = [];

  for (const f of data.features ?? []) {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates; // GeoJSON: [lon, lat]
    const detail = [p.city ?? p.county ?? p.state, p.country]
      .filter(Boolean)
      .join(", ");
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
