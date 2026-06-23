"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadLocations,
  saveLocations,
  type SavedLocation,
} from "@/lib/locations";
import AddLocationBar from "@/components/AddLocationBar";
import LocationCalendar from "@/components/LocationCalendar";
import Legend from "@/components/Legend";
import SceneBackground, { type Court } from "@/components/SceneBackground";
import { useEstPhase } from "@/hooks/useEstPhase";
import type { Mood } from "@/lib/funstats";
import { startAmbient } from "@/lib/ambient";

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a",
];

export default function Home() {
  const phase = useEstPhase();
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [mood, setMood] = useState<Mood>("clear");
  const [court, setCourt] = useState<Court>("grass");
  const [soundOn, setSoundOn] = useState(false);
  const [ballRain, setBallRain] = useState(false);
  const stopSound = useRef<(() => void) | null>(null);

  // Load saved locations + court once on mount.
  useEffect(() => {
    setLocations(loadLocations());
    const c = localStorage.getItem("vb-court");
    if (c === "beach" || c === "grass") setCourt(c);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveLocations(locations);
  }, [locations, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem("vb-court", court);
  }, [court, hydrated]);

  // Konami code → rain volleyballs for a few seconds.
  useEffect(() => {
    let i = 0;
    function onKey(e: KeyboardEvent) {
      i = e.key === KONAMI[i] ? i + 1 : e.key === KONAMI[0] ? 1 : 0;
      if (i === KONAMI.length) {
        i = 0;
        setBallRain(true);
        setTimeout(() => setBallRain(false), 8000);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleSound() {
    if (soundOn) {
      stopSound.current?.();
      stopSound.current = null;
      setSoundOn(false);
    } else {
      stopSound.current = startAmbient();
      setSoundOn(true);
    }
  }

  function addLocation(loc: SavedLocation) {
    setLocations((prev) => [...prev, loc]);
  }
  function removeLocation(id: string) {
    setLocations((prev) => prev.filter((l) => l.id !== id));
  }

  const subText = phase.isDark ? "text-slate-100/90" : "text-slate-700";
  const chip =
    "rounded-full bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm transition-colors hover:bg-white/70";

  return (
    <main className="relative mx-auto max-w-2xl px-4 pb-[36vh] pt-8">
      <SceneBackground phase={phase} mood={mood} court={court} ballRain={ballRain} />

      {/* control cluster */}
      <div className="mb-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setCourt((c) => (c === "grass" ? "beach" : "grass"))}
          className={chip}
        >
          {court === "grass" ? "🌳 Grass" : "🏖️ Beach"}
        </button>
        <button type="button" onClick={toggleSound} className={chip}>
          {soundOn ? "🔊 Sound on" : "🔇 Sound off"}
        </button>
      </div>

      <header className="mb-6 animate-fade-in-up">
        <h1 className="bg-gradient-to-r from-white via-cyan-100 to-amber-200 bg-clip-text font-display text-3xl font-extrabold tracking-tight text-transparent [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">
          🏐 Volleyball Weather
        </h1>
        <p className={`mt-1.5 text-sm font-medium ${subText} [text-shadow:0_1px_6px_rgba(0,0,0,0.25)]`}>
          Green days are dry with wind under 20 mph during your play window —
          weekdays 5–9pm, weekends 2–9pm. Forecast covers the next ~16 days.
        </p>
      </header>

      <div className="space-y-4">
        <AddLocationBar onAdd={addLocation} />

        {hydrated && locations.length === 0 && (
          <p className="animate-fade-in-up rounded-2xl border border-dashed border-white/70 bg-white/30 p-8 text-center text-sm text-slate-600">
            👆 Add a location above to see its volleyball-weather calendar.
          </p>
        )}

        {locations.map((loc, i) => (
          <LocationCalendar
            key={loc.id}
            location={loc}
            onRemove={removeLocation}
            onMood={i === 0 ? setMood : undefined}
          />
        ))}

        <div className="rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur-sm">
          <Legend />
        </div>
      </div>
    </main>
  );
}
