// Add a volleyball session to the user's calendar — Google link or .ics download.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Local YYYYMMDDTHHMMSS for a given date + hour.
function stamp(iso: string, hour: number): string {
  const [y, m, d] = iso.split("-");
  return `${y}${m}${d}T${pad(hour)}0000`;
}

function details(label: string): { title: string; desc: string } {
  return {
    title: `🏐 Volleyball — ${label}`,
    desc: "Great weather window for outdoor volleyball (via Volleyball Weather).",
  };
}

export function googleCalendarUrl(
  label: string,
  iso: string,
  startHour: number,
  endHour: number
): string {
  const { title, desc } = details(label);
  const dates = `${stamp(iso, startHour)}/${stamp(iso, endHour)}`;
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
    details: desc,
    location: label,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function downloadIcs(
  label: string,
  iso: string,
  startHour: number,
  endHour: number
): void {
  const { title, desc } = details(label);
  const now =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Volleyball Weather//EN",
    "BEGIN:VEVENT",
    `UID:${iso}-${startHour}@volleyball-weather`,
    `DTSTAMP:${now}`,
    `DTSTART:${stamp(iso, startHour)}`,
    `DTEND:${stamp(iso, endHour)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${label}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `volleyball-${iso}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
