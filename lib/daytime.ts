// Time-of-day → sky palette, locked to fixed Eastern Standard Time (UTC-5, no DST).

export interface Celestial {
  xPct: number; // horizontal position, 0=left 100=right
  yPct: number; // vertical position, 0=top 100=bottom (horizon ~62)
  color: string;
  glow: string; // rgba glow color
}

export interface Phase {
  id: "night" | "dawn" | "day" | "golden" | "dusk";
  isDark: boolean; // dark sky -> use light page text
  skyTop: string;
  skyBottom: string;
  sun?: Celestial;
  moon?: Celestial;
  showStars: boolean;
  cloudTint: string;
  waterTint: string; // top color of the river band
  skylineTint: string; // NJ skyline silhouette
  boardwalkTint: string; // waterfront promenade between water and grass
  grassTop: string; // hazier distant lawn near the waterline
  grassBottom: string; // rich foreground grass
  foliageTint: string; // framing + mid-ground trees
}

// Convert any clock to fixed UTC-5, regardless of the viewer's timezone or DST.
export function getEstHour(now: Date = new Date()): number {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000; // -> true UTC
  const est = new Date(utcMs - 5 * 3600 * 1000); // UTC-5
  return est.getHours() + est.getMinutes() / 60;
}

export function getPhase(hour: number): Phase {
  // night: 21–5
  if (hour >= 21 || hour < 5) {
    return {
      id: "night",
      isDark: true,
      skyTop: "#0b1026",
      skyBottom: "#1b2450",
      moon: { xPct: 74, yPct: 20, color: "#f4f6ff", glow: "rgba(220,230,255,0.45)" },
      showStars: true,
      cloudTint: "rgba(40,52,98,0.55)",
      waterTint: "#3a4f80",
      skylineTint: "#0a1330",
      boardwalkTint: "#2f3147",
      grassTop: "#2c3f38",
      grassBottom: "#1d2c28",
      foliageTint: "#16241c",
    };
  }
  // dawn: 5–7
  if (hour < 7) {
    return {
      id: "dawn",
      isDark: true,
      skyTop: "#3a3a73",
      skyBottom: "#f6a36b",
      sun: { xPct: 18, yPct: 52, color: "#ffd9a0", glow: "rgba(255,180,120,0.55)" },
      showStars: true, // faint, fading
      cloudTint: "rgba(255,190,160,0.45)",
      waterTint: "#5a4a7a",
      skylineTint: "#2c2750",
      boardwalkTint: "#8a7d83",
      grassTop: "#6f8a64",
      grassBottom: "#4d6b45",
      foliageTint: "#2c4a30",
    };
  }
  // day: 7–16
  if (hour < 16) {
    return {
      id: "day",
      isDark: false,
      skyTop: "#2a8fe0",
      skyBottom: "#bfe6ff",
      sun: { xPct: 76, yPct: 16, color: "#fff3c4", glow: "rgba(255,240,180,0.65)" },
      showStars: false,
      cloudTint: "rgba(255,255,255,0.9)",
      waterTint: "#3f9fd6",
      skylineTint: "#7c93ad",
      boardwalkTint: "#cbb89c",
      grassTop: "#7cbf4f",
      grassBottom: "#4f9a35",
      foliageTint: "#2f6d34",
    };
  }
  // golden: 16–18.5
  if (hour < 18.5) {
    return {
      id: "golden",
      isDark: false,
      skyTop: "#f6a64a",
      skyBottom: "#ff7e8a",
      sun: { xPct: 22, yPct: 46, color: "#fff0c0", glow: "rgba(255,150,90,0.6)" },
      showStars: false,
      cloudTint: "rgba(255,210,170,0.85)",
      waterTint: "#d98a6a",
      skylineTint: "#7a5560",
      boardwalkTint: "#c2a07f",
      grassTop: "#9bbf63",
      grassBottom: "#6f9440",
      foliageTint: "#3c5f30",
    };
  }
  // dusk: 18.5–21
  return {
    id: "dusk",
    isDark: true,
    skyTop: "#2b2a55",
    skyBottom: "#7d4a78",
    sun: { xPct: 16, yPct: 60, color: "#ffd0a0", glow: "rgba(255,140,110,0.5)" },
    showStars: true,
    cloudTint: "rgba(120,90,130,0.55)",
    waterTint: "#3a2f55",
    skylineTint: "#241f44",
    boardwalkTint: "#6e6275",
    grassTop: "#5d7a52",
    grassBottom: "#3c5238",
    foliageTint: "#26402a",
  };
}
