"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { searchPlaces, type GeoResult } from "@/lib/geocode";
import type { SavedLocation } from "@/lib/locations";
import { makeId } from "@/lib/locations";

// Lazy-load the map (Leaflet) only when opened — keeps it out of the main bundle.
const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false });

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1";

export default function AddLocationBar({
  onAdd,
  biasTo,
}: {
  onAdd: (loc: SavedLocation) => void;
  biasTo?: { lat: number; lon: number };
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1); // keyboard-highlighted option
  const [mapOpen, setMapOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Debounced predictive search: ~300ms after the user stops typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setNoResults(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchPlaces(q, biasTo);
        if (!cancelled) {
          setResults(r);
          setNoResults(r.length === 0);
          setActive(r.length ? 0 : -1);
          setOpen(true);
        }
      } catch {
        /* ignore transient typeahead errors */
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, biasTo?.lat, biasTo?.lon]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function add(loc: SavedLocation) {
    onAdd(loc);
    setQuery("");
    setResults([]);
    setNoResults(false);
    setOpen(false);
    setActive(-1);
  }

  function addResult(r: GeoResult) {
    add({ id: makeId(), label: r.label, lat: r.lat, lon: r.lon, detail: r.detail });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown" && results.length) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      addResult(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
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
    <div className="relative z-30 rounded-2xl border border-white/70 bg-white/55 p-4 shadow-lg shadow-sky-900/5 backdrop-blur-md">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500 disabled:opacity-50 sm:w-auto sm:justify-start ${focusRing}`}
        >
          📍 Use my location
        </button>

        <div ref={boxRef} className="relative w-full sm:flex-1">
          <label htmlFor="city-search" className="sr-only">
            Search for a park, court, or city
          </label>
          <input
            id="city-search"
            type="text"
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              active >= 0 ? `${listId}-opt-${active}` : undefined
            }
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search a park, court, or city…"
            className={`min-h-[44px] w-full rounded-lg border border-slate-300 bg-white/90 px-3 text-base text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-300/50`}
          />

          {open && (results.length > 0 || noResults) && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-30 mt-1 w-full animate-slide-down overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
            >
              {results.map((r, i) => (
                <li key={i} role="option" aria-selected={i === active} id={`${listId}-opt-${i}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => addResult(r)}
                    className={`flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm ${
                      i === active ? "bg-sky-100 text-sky-900" : "text-slate-700"
                    }`}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {r.kind === "park" ? "🏞️" : "📍"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.label}</span>
                      {r.detail && (
                        <span className="line-clamp-2 block text-xs text-slate-400">
                          {r.detail}
                        </span>
                      )}
                    </span>
                    <span className="hidden shrink-0 text-xs tabular-nums text-slate-400 sm:block">
                      {r.lat.toFixed(2)}, {r.lon.toFixed(2)}
                    </span>
                  </button>
                </li>
              ))}
              {noResults && (
                <li className="flex min-h-[44px] items-center px-3 text-sm text-slate-400">
                  No matches — try another spelling
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm font-medium text-rose-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className={`inline-flex min-h-[36px] items-center rounded-md px-2 text-xs font-medium text-sky-700 hover:bg-sky-500/10 ${focusRing}`}
        >
          📌 Can’t find it? Drop a pin on the map
        </button>
        <span className="text-[11px] text-slate-500">
          Places © OpenStreetMap
        </span>
      </div>

      {mapOpen && (
        <MapPicker
          initial={biasTo}
          onAdd={onAdd}
          onClose={() => setMapOpen(false)}
        />
      )}
    </div>
  );
}
