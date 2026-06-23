"use client";

import type { CalendarCell } from "@/lib/calendar";
import type { DayWeather } from "@/lib/weather";
import DayTile from "./DayTile";

const HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarGrid({
  weeks,
  forecast,
  selected,
  bestIso,
  onSelect,
}: {
  weeks: CalendarCell[][];
  forecast: Map<string, DayWeather>;
  selected: string | null;
  bestIso?: string | null;
  onSelect: (iso: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {HEADERS.map((h) => (
          <div key={h}>{h}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((cell, i) => (
          <DayTile
            key={cell.iso}
            cell={cell}
            weather={forecast.get(cell.iso)}
            selected={selected === cell.iso}
            index={i}
            isBest={!!bestIso && cell.iso === bestIso && cell.inRange}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
