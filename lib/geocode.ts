// Open-Meteo geocoding: city name -> coordinates. Free, no key.

export interface GeoResult {
  label: string;
  lat: number;
  lon: number;
}

interface OpenMeteoGeo {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    admin1?: string;
    country_code?: string;
  }[];
}

export async function searchCity(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];

  const url =
    `https://geocoding-api.open-meteo.com/v1/search` +
    `?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Location search failed (${res.status})`);
  const data = (await res.json()) as OpenMeteoGeo;

  return (data.results ?? []).map((r) => {
    const parts = [r.name, r.admin1, r.country_code].filter(Boolean);
    return {
      label: parts.join(", "),
      lat: r.latitude,
      lon: r.longitude,
    };
  });
}
