"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadLocations,
  saveLocations,
  type SavedLocation,
} from "@/lib/locations";
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  type Settings,
} from "@/lib/settings";
import type { DayWeather } from "@/lib/weather";
import AddLocationBar from "@/components/AddLocationBar";
import LocationCalendar from "@/components/LocationCalendar";
import SettingsPanel from "@/components/SettingsPanel";
import Legend from "@/components/Legend";
import SceneBackground, { type Court } from "@/components/SceneBackground";
import { useEstPhase } from "@/hooks/useEstPhase";
import { prettyDay, type Mood } from "@/lib/funstats";
import { startAmbient } from "@/lib/ambient";

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a",
];

export default function Home() {
  const phase = useEstPhase();
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [mood, setMood] = useState<Mood>("clear");
  const [court, setCourt] = useState<Court>("grass");
  const [soundOn, setSoundOn] = useState(false);
  const [ballRain, setBallRain] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bests, setBests] = useState<Record<string, { label: string; best: DayWeather | null }>>({});
  const stopSound = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLocations(loadLocations());
    setSettings(loadSettings());
    const c = localStorage.getItem("vb-court");
    if (c === "beach" || c === "grass") setCourt(c);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveLocations(locations);
  }, [locations, hydrated]);
  useEffect(() => {
    if (hydrated) saveSettings(settings);
  }, [settings, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem("vb-court", court);
  }, [court, hydrated]);

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

  const reportBest = useCallback(
    (id: string, label: string, best: DayWeather | null) =>
      setBests((prev) => ({ ...prev, [id]: { label, best } })),
    []
  );

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
    setBests((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }

  // Best spot across locations: greenest, earliest best day.
  const topSpot =
    locations.length > 1
      ? Object.values(bests)
          .filter((b) => b.best)
          .sort((a, b) => {
            const ra = a.best!.goodHours / a.best!.totalHours;
            const rb = b.best!.goodHours / b.best!.totalHours;
            if (rb !== ra) return rb - ra;
            return a.best!.iso.localeCompare(b.best!.iso);
          })[0]
      : undefined;

  const subText = phase.isDark ? "text-slate-100/90" : "text-slate-100/95";
  const chip =
    "inline-flex min-h-[44px] items-center rounded-full bg-white/45 px-4 text-xs font-medium text-slate-800 backdrop-blur-sm transition-colors hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";

  return (
    <main className="relative mx-auto max-w-2xl px-4 pb-[36vh] pt-8">
      <SceneBackground phase={phase} mood={mood} court={court} ballRain={ballRain} />

      <div className="mb-4 flex justify-end gap-2">
        <button type="button" onClick={() => setSettingsOpen((o) => !o)} className={chip}>
          ⚙️ Settings
        </button>
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

      {settingsOpen && (
        <div className="mb-4">
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      )}

      <header className="mb-6 animate-fade-in-up rounded-2xl bg-slate-900/25 px-4 py-3 backdrop-blur-[2px]">
        <h1 className="bg-gradient-to-r from-white via-cyan-100 to-amber-200 bg-clip-text font-display text-3xl font-extrabold tracking-tight text-transparent [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">
          🏐 Volleyball Weather
        </h1>
        <p className={`mt-1.5 text-sm font-medium ${subText} [text-shadow:0_1px_6px_rgba(0,0,0,0.35)]`}>
          Green days match your play window &amp; limits — tune them in Settings.
          Forecast covers the next ~16 days.
        </p>
      </header>

      <div className="space-y-4">
        <AddLocationBar onAdd={addLocation} />

        {topSpot?.best && (
          <div className="animate-fade-in-up rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-2 text-sm font-medium text-amber-800 backdrop-blur-sm">
            🏅 Best spot this stretch: <strong>{topSpot.label}</strong> — {prettyDay(topSpot.best.iso)}
          </div>
        )}

        {hydrated && locations.length === 0 && (
          <p className="animate-fade-in-up rounded-2xl border border-dashed border-white/70 bg-white/30 p-8 text-center text-sm text-slate-600">
            👆 Add a location above to see its volleyball-weather calendar.
          </p>
        )}

        {locations.map((loc, i) => (
          <LocationCalendar
            key={loc.id}
            location={loc}
            settings={settings}
            onRemove={removeLocation}
            onMood={i === 0 ? setMood : undefined}
            onBest={reportBest}
          />
        ))}

        <div className="rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur-sm">
          <Legend />
        </div>
      </div>
    </main>
  );
}
