"use client";

import type { CalendarCell } from "@/lib/calendar";
import type { DayWeather } from "@/lib/weather";
import { dayEmoji, prettyDay } from "@/lib/funstats";
import { spikeConfetti } from "@/lib/confetti";

const COLOR_WORD: Record<string, string> = {
  green: "all good",
  yellow: "mixed weather",
  red: "mostly bad",
};

// Gradient fills + matching glow per stoplight color.
const COLOR_STYLE: Record<string, string> = {
  green:
    "bg-gradient-to-br from-emerald-400 to-green-600 text-emerald-950 shadow-emerald-500/30",
  yellow:
    "bg-gradient-to-br from-amber-300 to-yellow-500 text-yellow-950 shadow-amber-400/30",
  red: "bg-gradient-to-br from-rose-400 to-red-600 text-red-950 shadow-rose-500/30",
};

export default function DayTile({
  cell,
  weather,
  selected,
  index,
  isBest,
  dimmed,
  onSelect,
}: {
  cell: CalendarCell;
  weather?: DayWeather;
  selected: boolean;
  index: number;
  isBest?: boolean;
  dimmed?: boolean;
  onSelect: (iso: string) => void;
}) {
  const delay = { animationDelay: `${Math.min(index * 18, 400)}ms` };

  function handleClick(e: React.MouseEvent) {
    onSelect(cell.iso);
    if (weather?.color === "green") spikeConfetti(e.clientX, e.clientY);
  }

  // Out of range, or no forecast -> inert tile.
  if (!cell.inRange || !weather) {
    return (
      <div
        style={delay}
        className={`aspect-square animate-fade-in-up rounded-lg p-1.5 text-xs ${
          cell.inRange
            ? "bg-white/40 text-slate-500"
            : "bg-white/15 text-slate-400/70"
        }`}
      >
        <span className={cell.isToday ? "font-bold underline" : ""}>
          {cell.dayOfMonth}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={delay}
      title={`${weather.goodHours}/${weather.totalHours} good hours · max wind ${weather.maxWind} mph`}
      aria-label={`${prettyDay(cell.iso)} — ${COLOR_WORD[weather.color]}${
        isBest ? " (best day to play)" : ""
      }, ${weather.goodHours} of ${weather.totalHours} playable hours, ${weather.loTemp} to ${weather.hiTemp} degrees, max wind ${weather.maxWind}`}
      className={`group relative aspect-square animate-pop-in rounded-lg p-1.5 text-left text-xs shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.06] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white/70 ${
        COLOR_STYLE[weather.color]
      } ${dimmed && weather.color !== "green" ? "opacity-30 saturate-50" : ""} ${
        selected ? "ring-2 ring-slate-800/80 ring-offset-2 ring-offset-white/60" : ""
      } ${isBest ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-white/60" : ""}`}
    >
      <span className={cell.isToday ? "font-bold underline" : "font-semibold"}>
        {cell.dayOfMonth}
      </span>
      {/* glanceable weather emoji */}
      <span className="absolute left-1 top-1 text-[11px] leading-none">
        {isBest ? "🏆" : dayEmoji(weather)}
      </span>
      {cell.isToday && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-white/90" />
      )}
      <span className="absolute bottom-1 right-1 text-[9px] font-medium opacity-70 transition-opacity group-hover:opacity-100">
        {weather.goodHours}/{weather.totalHours}
      </span>
    </button>
  );
}
