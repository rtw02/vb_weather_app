"use client";

import { useEffect, useState } from "react";
import {
  loadLocations,
  saveLocations,
  type SavedLocation,
} from "@/lib/locations";
import AddLocationBar from "@/components/AddLocationBar";
import LocationCalendar from "@/components/LocationCalendar";
import Legend from "@/components/Legend";
import SceneBackground from "@/components/SceneBackground";
import { useEstPhase } from "@/hooks/useEstPhase";

export default function Home() {
  const phase = useEstPhase();
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load saved locations once on mount (client only).
  useEffect(() => {
    setLocations(loadLocations());
    setHydrated(true);
  }, []);

  // Persist whenever the list changes (after initial hydration).
  useEffect(() => {
    if (hydrated) saveLocations(locations);
  }, [locations, hydrated]);

  function addLocation(loc: SavedLocation) {
    setLocations((prev) => [...prev, loc]);
  }

  function removeLocation(id: string) {
    setLocations((prev) => prev.filter((l) => l.id !== id));
  }

  const subText = phase.isDark ? "text-slate-100/90" : "text-slate-700";

  return (
    <main className="relative mx-auto max-w-2xl px-4 pb-[36vh] pt-8">
      <SceneBackground phase={phase} />

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

        {locations.map((loc) => (
          <LocationCalendar
            key={loc.id}
            location={loc}
            onRemove={removeLocation}
          />
        ))}

        <div className="rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur-sm">
          <Legend />
        </div>
      </div>

    </main>
  );
}
