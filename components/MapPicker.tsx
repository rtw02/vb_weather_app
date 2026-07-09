"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { reverseGeocode } from "@/lib/geocode";
import type { SavedLocation } from "@/lib/locations";
import { makeId } from "@/lib/locations";

// Emoji pin so we don't depend on Leaflet's (bundler-broken) default marker assets.
const pinIcon = L.divIcon({
  html: '<div style="font-size:30px;line-height:1;transform:translate(-3px,-6px)">📍</div>',
  className: "",
  iconSize: [30, 30],
  iconAnchor: [12, 30],
});

const DEFAULT: [number, number] = [40.7128, -74.006]; // NYC fallback

export default function MapPicker({
  initial,
  onAdd,
  onClose,
}: {
  initial?: { lat: number; lon: number };
  onAdd: (loc: SavedLocation) => void;
  onClose: () => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const revTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touched = useRef(false); // user moved the pin?

  const [coords, setCoords] = useState<[number, number]>([
    initial?.lat ?? DEFAULT[0],
    initial?.lon ?? DEFAULT[1],
  ]);
  const [place, setPlace] = useState<{ label: string; detail?: string } | null>(null);
  const [looking, setLooking] = useState(true);

  // Reverse-geocode (debounced) whenever the pin settles.
  function lookup(lat: number, lon: number) {
    setLooking(true);
    if (revTimer.current) clearTimeout(revTimer.current);
    revTimer.current = setTimeout(async () => {
      const r = await reverseGeocode(lat, lon);
      setPlace(r ? { label: r.label, detail: r.detail } : { label: "Pinned location" });
      setLooking(false);
    }, 400);
  }

  function moveTo(lat: number, lon: number, recenter = false) {
    setCoords([lat, lon]);
    markerRef.current?.setLatLng([lat, lon]);
    if (recenter) mapRef.current?.setView([lat, lon], mapRef.current.getZoom());
    lookup(lat, lon);
  }

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current).setView(coords, 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(coords, { icon: pinIcon, draggable: true }).addTo(map);
    marker.on("dragend", () => {
      touched.current = true;
      const p = marker.getLatLng();
      moveTo(p.lat, p.lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      touched.current = true;
      moveTo(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 60); // modal sizing
    lookup(coords[0], coords[1]);

    // Default to the user's current location, unless they've already dragged.
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        if (!touched.current) moveTo(pos.coords.latitude, pos.coords.longitude, true);
      },
      () => {},
      { timeout: 8000 }
    );

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function confirm() {
    onAdd({
      id: makeId(),
      label: place?.label ?? "Pinned location",
      lat: coords[0],
      lon: coords[1],
      detail: place?.detail,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pick a location on the map"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            📌 Drop a pin on your court
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close map"
            className="min-h-[36px] rounded px-2 text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div ref={mapEl} className="h-[55vh] w-full" />

        <div className="space-y-3 p-4">
          <div className="text-sm">
            <div className="font-medium text-slate-800">
              {looking ? "Locating…" : place?.label ?? "Pinned location"}
            </div>
            {place?.detail && !looking && (
              <div className="text-xs text-slate-500">{place.detail}</div>
            )}
            <div className="mt-0.5 text-xs tabular-nums text-slate-400">
              {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Drag the pin or tap the map to set the exact spot.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              className="min-h-[44px] rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Add this spot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
