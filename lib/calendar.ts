// Build a Sun->Sat week grid covering today through today + (days-1).

export interface CalendarCell {
  iso: string; // YYYY-MM-DD (local)
  dayOfMonth: number;
  inRange: boolean; // within [today, end] -> eligible for a forecast color
  isToday: boolean;
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

// Returns an array of week rows; each row is 7 cells (Sun..Sat).
export function buildWeeks(today: Date, days = 16): CalendarCell[][] {
  const start0 = stripTime(today);
  const end = addDays(start0, days - 1);
  const todayIso = toISO(start0);

  // Grid starts on the Sunday of today's week.
  const gridStart = addDays(start0, -start0.getDay());
  // Grid ends on the Saturday of the end date's week.
  const gridEnd = addDays(end, 6 - end.getDay());

  const weeks: CalendarCell[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const row: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = toISO(cursor);
      row.push({
        iso,
        dayOfMonth: cursor.getDate(),
        inRange: cursor >= start0 && cursor <= end,
        isToday: iso === todayIso,
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(row);
  }
  return weeks;
}
