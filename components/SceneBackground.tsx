"use client";

import { useEffect, useRef, useState } from "react";
import type { Phase } from "@/lib/daytime";

// Deterministic star field (avoids hydration mismatch from Math.random).
const STARS = Array.from({ length: 46 }, (_, i) => {
  const x = (i * 137.5) % 1200;
  const y = (i * 71.3) % 360;
  const r = 0.6 + ((i * 53) % 10) / 10;
  const delay = ((i * 37) % 40) / 10; // 0–4s
  return { x, y: y + 8, r, delay };
});

// Seeded PRNG (mulberry32) — deterministic so SSR and client render identically.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scatter `n` trees across an x-range with random spot, size, and baseline.
function scatter(rand: () => number, xMin: number, xMax: number, n: number) {
  return Array.from({ length: n }, () => ({
    x: xMin + rand() * (xMax - xMin),
    y: 78 + rand() * 24,
    s: 0.45 + rand() * 0.8,
  }));
}

// Two clusters flanking the center net (which spans ~x300–900), left + right.
const TREE_RNG = mulberry32(20260622);
const MID_TREES = [
  ...scatter(TREE_RNG, 20, 285, 8), // left cluster
  ...scatter(TREE_RNG, 915, 1180, 8), // right cluster
].sort((a, b) => a.s - b.s); // smaller (distant) drawn first for depth

// A leafy tree cluster: overlapping blobs + optional trunk.
function Tree({
  x,
  y,
  s,
  fill,
  trunk,
}: {
  x: number;
  y: number;
  s: number;
  fill: string;
  trunk?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      {trunk && <rect x={-5} y={6} width={10} height={40} fill="#5a4122" />}
      <ellipse cx={0} cy={-18} rx={34} ry={30} />
      <ellipse cx={-26} cy={2} rx={28} ry={26} />
      <ellipse cx={26} cy={2} rx={28} ry={26} />
      <ellipse cx={0} cy={10} rx={32} ry={24} />
    </g>
  );
}

export default function SceneBackground({ phase }: { phase: Phase }) {
  const celestial = phase.sun ?? phase.moon;
  const isMoon = !!phase.moon && !phase.sun;
  const cx = celestial ? (celestial.xPct / 100) * 1200 : 0;
  const cy = celestial ? (celestial.yPct / 100) * 600 : 0;

  // Pause every CSS animation when the tab is hidden or the scene is scrolled
  // out of view — no wasted repaints / battery while nothing is visible.
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    let onScreen = true;

    const sync = () => setActive(onScreen && !document.hidden);

    const io = el
      ? new IntersectionObserver(([e]) => {
          onScreen = e.isIntersecting;
          sync();
        })
      : null;
    io?.observe(el!);

    document.addEventListener("visibilitychange", sync);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${
        active ? "" : "[&_*]:![animation-play-state:paused]"
      }`}
    >
      {/* 1. Continuous gradient — seamless sky → water → grass. */}
      <div
        className="absolute inset-0 transition-[background] duration-1000 ease-in-out"
        style={{
          background: `linear-gradient(180deg, ${phase.skyTop} 0%, ${phase.skyBottom} 46%, ${phase.waterTint} 55%, ${phase.waterTint} 66%, ${phase.boardwalkTint} 69%, ${phase.boardwalkTint} 71%, ${phase.grassTop} 74%, ${phase.grassBottom} 100%)`,
        }}
      />

      {/* 2. Noise dither — breaks up gradient banding (the faint "lines"). */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.06] mix-blend-soft-light">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="2"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      {/* 3. Sky: stars, sun/moon, drifting clouds. */}
      <svg
        className="absolute inset-x-0 top-0 h-[72%] w-full"
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={celestial?.glow ?? "transparent"} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {phase.showStars &&
          STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#ffffff"
              className="animate-twinkle"
              style={{ animationDelay: `${s.delay}s` }}
            />
          ))}

        {celestial && (
          <g>
            <circle cx={cx} cy={cy} r="150" fill="url(#glow)" />
            <circle cx={cx} cy={cy} r="46" fill={celestial.color} />
            {isMoon && <circle cx={cx + 18} cy={cy - 6} r="40" fill={phase.skyTop} />}
          </g>
        )}

        {[
          { y: 110, s: 1.2, dur: 95, delay: 0 },
          { y: 210, s: 0.85, dur: 72, delay: -25 },
          { y: 70, s: 0.65, dur: 125, delay: -60 },
        ].map((c, i) => (
          <g
            key={i}
            className="animate-drift"
            style={{ animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
          >
            <g transform={`translate(-220 ${c.y}) scale(${c.s})`} fill="rgba(255,255,255,0.92)">
              <ellipse cx="60" cy="22" rx="62" ry="24" />
              <ellipse cx="115" cy="10" rx="50" ry="30" />
              <ellipse cx="165" cy="26" rx="54" ry="22" />
              <ellipse cx="100" cy="34" rx="80" ry="20" />
            </g>
          </g>
        ))}
      </svg>

      {/* 4. NJ skyline across the Hudson — a hazy back row + a sharper front row. */}
      <svg
        className="absolute inset-x-0 w-full"
        style={{ top: "47%", height: "8.5%" }}
        viewBox="0 0 1200 90"
        preserveAspectRatio="none"
      >
        {/* back row — taller towers, hazed into the sky */}
        <g fill={phase.skylineTint} opacity={0.5}>
          {[
            [60, 56], [150, 70], [250, 48], [360, 78], [470, 58], [560, 84],
            [670, 52], [780, 74], [880, 60], [990, 80], [1090, 54], [1160, 68],
          ].map(([x, h], i) => (
            <rect key={i} x={x} y={90 - h} width={64} height={h} />
          ))}
        </g>
        {/* front row — denser, sharper */}
        <g fill={phase.skylineTint} opacity={0.95}>
          {[
            [30, 40], [78, 26], [120, 52], [168, 30], [212, 60], [262, 38],
            [308, 26], [350, 64], [398, 34], [442, 50], [492, 26], [542, 56],
            [592, 34], [642, 62], [698, 28], [748, 48], [798, 24], [852, 58],
            [904, 34], [956, 54], [1008, 28], [1062, 60], [1116, 36], [1162, 50],
          ].map(([x, h], i) => (
            <rect key={i} x={x} y={90 - h} width={42} height={h} />
          ))}
        </g>
      </svg>

      {/* 5. The Hudson — soft horizontal ripple bands + drifting sparkles. */}
      <div className="absolute inset-x-0 overflow-hidden" style={{ top: "55%", height: "11%" }}>
        {/* gentle reflective ripple bands */}
        {[14, 32, 50, 68, 86].map((t, i) => (
          <div
            key={`r${i}`}
            className="animate-twinkle absolute inset-x-0 bg-white/10 blur-[2px]"
            style={{
              top: `${t}%`,
              height: "3px",
              animationDelay: `${i * 0.6}s`,
              animationDuration: "5s",
            }}
          />
        ))}
        {/* brighter sun/moon sparkles drifting on the surface */}
        {[
          { l: 16, t: 28, w: 20 },
          { l: 52, t: 60, w: 26 },
          { l: 76, t: 40, w: 16 },
        ].map((s, i) => (
          <div
            key={`s${i}`}
            className="animate-twinkle absolute rounded-full bg-white/25 blur-md"
            style={{
              left: `${s.l}%`,
              top: `${s.t}%`,
              width: `${s.w}%`,
              height: "8px",
              animationDelay: `${i * 0.9 + 0.3}s`,
              animationDuration: "4.5s",
            }}
          />
        ))}
      </div>

      {/* 6. Boardwalk promenade — plank seams + waterfront railing along its back edge. */}
      <svg
        className="absolute inset-x-0 w-full"
        style={{ top: "67%", height: "5%" }}
        viewBox="0 0 1200 50"
        preserveAspectRatio="none"
      >
        {/* railing along the water side */}
        <rect x={0} y={4} width={1200} height={2.5} fill="rgba(255,255,255,0.22)" />
        {Array.from({ length: 48 }).map((_, i) => (
          <rect key={i} x={i * 25 + 6} y={4} width={2} height={13} fill="rgba(255,255,255,0.16)" />
        ))}
        {/* plank seams */}
        {Array.from({ length: 24 }).map((_, i) => (
          <rect key={`p${i}`} x={i * 52} y={22} width={1.5} height={28} fill="rgba(0,0,0,0.10)" />
        ))}
      </svg>

      {/* Mid-ground trees sitting on the lawn behind the net. */}
      <svg
        className="absolute inset-x-0 w-full"
        style={{ top: "68%", height: "16%" }}
        viewBox="0 0 1200 160"
        preserveAspectRatio="xMidYMax meet"
      >
        {MID_TREES.map((t, i) => (
          <Tree key={i} x={t.x} y={t.y} s={t.s} fill={phase.foliageTint} trunk={t.s > 0.5} />
        ))}
      </svg>

      {/* 7. Framing canopy trees in the top corners (gentle sway). */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMin slice"
      >
        <g className="animate-sway-slow" style={{ transformOrigin: "600px 0px" }}>
          <g fill={phase.foliageTint}>
            {/* top-left canopy */}
            <ellipse cx={70} cy={40} rx={210} ry={170} />
            <ellipse cx={250} cy={20} rx={150} ry={120} />
            <ellipse cx={150} cy={170} rx={130} ry={110} />
            {/* top-right canopy */}
            <ellipse cx={1140} cy={50} rx={220} ry={175} />
            <ellipse cx={950} cy={25} rx={150} ry={120} />
            <ellipse cx={1060} cy={180} rx={130} ry={110} />
            {/* center overhang */}
            <ellipse cx={600} cy={-40} rx={260} ry={120} />
            <ellipse cx={420} cy={-30} rx={150} ry={90} />
            <ellipse cx={780} cy={-30} rx={150} ry={90} />
          </g>
        </g>
      </svg>

      {/* 8. Net + ball on the grass. */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[42%] w-full"
        viewBox="0 0 1200 480"
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          <pattern id="netMesh" width="26" height="26" patternUnits="userSpaceOnUse">
            <path
              d="M26 0H0V26"
              fill="none"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>

        <g className="animate-sway" style={{ transformOrigin: "600px 150px" }}>
          <rect x={300} y={150} width={14} height={320} fill="#6b4f2a" rx={4} />
          <rect x={886} y={150} width={14} height={320} fill="#6b4f2a" rx={4} />
          <circle cx={307} cy={150} r={10} fill="#5a4122" />
          <circle cx={893} cy={150} r={10} fill="#5a4122" />
          <rect x={307} y={162} width={586} height={12} fill="#ffffff" />
          <rect x={307} y={372} width={586} height={9} fill="#eef0f2" />
          <rect x={307} y={174} width={586} height={198} fill="url(#netMesh)" />
        </g>

        <g className="animate-arc">
          <circle cx={0} cy={0} r={15} fill="#f8f5ef" />
          <path
            d="M-15 0 A15 15 0 0 1 15 0 M0 -15 A20 20 0 0 0 0 15 M-13 -7 A24 24 0 0 0 13 -7"
            fill="none"
            stroke="#c9a24a"
            strokeWidth="1.6"
          />
        </g>
      </svg>
    </div>
  );
}
