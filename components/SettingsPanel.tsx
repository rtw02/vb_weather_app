"use client";

import {
  convertTemp,
  convertWind,
  hourLabel,
  type Settings,
  type TempUnit,
  type WindUnit,
} from "@/lib/settings";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HourSelect({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (h: number) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-slate-600">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-[36px] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {hourLabel(h)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}) {
  const s = settings;
  const set = (patch: Partial<Settings>) => onChange({ ...s, ...patch });

  function setTempUnit(u: TempUnit) {
    if (u === s.tempUnit) return;
    set({
      tempUnit: u,
      tempMin: convertTemp(s.tempMin, s.tempUnit, u),
      tempMax: convertTemp(s.tempMax, s.tempUnit, u),
    });
  }
  function setWindUnit(u: WindUnit) {
    if (u === s.windUnit) return;
    set({ windUnit: u, windLimit: convertWind(s.windLimit, s.windUnit, u) });
  }

  const num =
    "min-h-[36px] w-16 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";
  const seg = (on: boolean) =>
    `min-h-[36px] rounded-md px-3 text-sm font-medium transition-colors ${
      on ? "bg-sky-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="animate-slide-down rounded-2xl border border-white/70 bg-white/80 p-4 text-slate-800 shadow-lg backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Play criteria</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="rounded px-2 text-slate-400 hover:text-slate-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <div className="mb-1 font-medium">Weekday window</div>
          <div className="flex items-center gap-2">
            <HourSelect label="Weekday start" value={s.weekdayStart} onChange={(h) => set({ weekdayStart: h })} />
            <span className="text-slate-400">to</span>
            <HourSelect label="Weekday end" value={s.weekdayEnd} onChange={(h) => set({ weekdayEnd: h })} />
          </div>
        </div>

        <div>
          <div className="mb-1 font-medium">Weekend window</div>
          <div className="flex items-center gap-2">
            <HourSelect label="Weekend start" value={s.weekendStart} onChange={(h) => set({ weekendStart: h })} />
            <span className="text-slate-400">to</span>
            <HourSelect label="Weekend end" value={s.weekendEnd} onChange={(h) => set({ weekendEnd: h })} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            <span className="font-medium">Max wind</span>
            <input
              type="number"
              className={num}
              value={s.windLimit}
              onChange={(e) => set({ windLimit: Number(e.target.value) })}
            />
            <span className="text-slate-500">{s.windUnit}</span>
          </label>

          <label className="flex items-center gap-2">
            <span className="font-medium">Temp</span>
            <input
              type="number"
              aria-label="Minimum temperature"
              className={num}
              value={s.tempMin}
              onChange={(e) => set({ tempMin: Number(e.target.value) })}
            />
            <span className="text-slate-400">–</span>
            <input
              type="number"
              aria-label="Maximum temperature"
              className={num}
              value={s.tempMax}
              onChange={(e) => set({ tempMax: Number(e.target.value) })}
            />
            <span className="text-slate-500">°{s.tempUnit}</span>
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={s.requireDaylight}
            onChange={(e) => set({ requireDaylight: e.target.checked })}
          />
          <span className="font-medium">Only count daylight hours</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={s.onlyGreen}
            onChange={(e) => set({ onlyGreen: e.target.checked })}
          />
          <span className="font-medium">Dim non-playable days</span>
        </label>

        <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-3">
          <div className="flex items-center gap-1">
            <span className="mr-1 font-medium">Units</span>
            <button type="button" className={seg(s.tempUnit === "F")} onClick={() => setTempUnit("F")}>°F</button>
            <button type="button" className={seg(s.tempUnit === "C")} onClick={() => setTempUnit("C")}>°C</button>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className={seg(s.windUnit === "mph")} onClick={() => setWindUnit("mph")}>mph</button>
            <button type="button" className={seg(s.windUnit === "kmh")} onClick={() => setWindUnit("kmh")}>km/h</button>
          </div>
        </div>
      </div>
    </div>
  );
}
