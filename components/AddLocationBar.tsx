"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchCity, type GeoResult } from "@/lib/geocode";
import type { SavedLocation } from "@/lib/locations";
import { makeId } from "@/lib/locations";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1";

export default function AddLocationBar({
  onAdd,
}: {
  onAdd: (loc: SavedLocation) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1); // keyboard-highlighted option
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
        const r = await searchCity(q);
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
  }, [query]);

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
    add({ id: makeId(), label: r.label, lat: r.lat, lon: r.lon });
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
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className={`inline-flex min-h-[44px] items-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500 disabled:opacity-50 ${focusRing}`}
        >
          📍 Use my location
        </button>

        <div ref={boxRef} className="relative min-w-[180px] flex-1">
          <label htmlFor="city-search" className="sr-only">
            Search for a city
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
            placeholder="Start typing a city…"
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
                    className={`flex min-h-[44px] w-full items-center justify-between px-3 text-left text-sm ${
                      i === active ? "bg-sky-100 text-sky-900" : "text-slate-700"
                    }`}
                  >
                    <span>{r.label}</span>
                    <span className="text-xs tabular-nums text-slate-400">
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
    </div>
  );
}
