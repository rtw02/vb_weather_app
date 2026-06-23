"use client";

import { useEffect, useRef, useState } from "react";
import { searchCity, type GeoResult } from "@/lib/geocode";
import type { SavedLocation } from "@/lib/locations";
import { makeId } from "@/lib/locations";

export default function AddLocationBar({
  onAdd,
}: {
  onAdd: (loc: SavedLocation) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced typeahead: search ~300ms after the user stops typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await searchCity(q);
        if (!cancelled) {
          setResults(r);
          setOpen(true);
        }
      } catch {
        /* ignore transient typeahead errors */
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function add(loc: SavedLocation) {
    onAdd(loc);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation not supported by this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        add({
          id: makeId(),
          label: "My location",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      (err) => {
        setBusy(false);
        setError(err.message || "Could not get your location.");
      }
    );
  }

  return (
    <div className="rounded-2xl border border-white/70 bg-white/55 p-4 shadow-lg shadow-sky-900/5 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500 disabled:opacity-50"
        >
          📍 Use my location
        </button>

        <div ref={boxRef} className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Start typing a city…"
            className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-300/50"
          />

          {open && results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full animate-slide-down overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() =>
                      add({ id: makeId(), label: r.label, lat: r.lat, lon: r.lon })
                    }
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-sky-50"
                  >
                    <span>{r.label}</span>
                    <span className="text-xs tabular-nums text-slate-400">
                      {r.lat.toFixed(2)}, {r.lon.toFixed(2)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>}
    </div>
  );
}
