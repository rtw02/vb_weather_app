"use client";

import { useEffect, useRef, useState } from "react";

// Timing + power 2-a-side beach volleyball. You are the LEFT team.
//   1. CPU (right) serves the ball over — just TAP when it reaches your passer
//      (no bar, judged on how close the ball is). Mistime it → shank.
//   2. Your setter sets it back, then a CHARGE bar appears — tap fast to fill
//      it into the green for a KILL. Weak fill → into the net.
// Land the kill → you score. Miss either touch → rally lost. Then CPU serves.
//
// Ball motion is JS/rAF-driven; its transform is written imperatively via ref.

const GROUND = 188;
const NET_X = 240;
const NET_TOP = 66;
const NET_BOTTOM = 138;

const SERVE_DUR = 1400; // ms the serve is in the air (bigger = easier pass timing)
const PASS_GREEN: [number, number] = [40, 96]; // wide, generous timing window (%)

// Spike meter: the green zone is randomized each attempt. Each tap raises the
// fill a fixed amount; stop tapping and it drains back down. Balance your taps
// to hold the fill in the green when it auto-releases.
const CHARGE_MS = 3500; // time before the shot auto-releases
const TAP_GAIN = 8; // base power per tap
const TAP_RAMP = 2.2; // extra power per consecutive tap (builds momentum)
const TAP_CAP = 26; // max power a single tap can add
const COMBO_MS = 1100; // taps within this gap keep the combo going (≈1/sec is fine)
const DECAY = 0.006; // slow drain — a tap every ~second still charges it up
const ZONE_MIN = 42; // green zone can start anywhere in [ZONE_MIN, ZONE_MAX]
const ZONE_MAX = 70;
const ZONE_W_MIN = 8; // green (kill) zone width range
const ZONE_W_MAX = 12;
const YELLOW_M = 13; // yellow (dug) margin on each side of the green

type Side = "left" | "right";
type Strk = "Ls" | "Lh" | "Rs" | "Rh" | null;
type Meter = "pass" | "spike" | null;

interface Pt {
  x: number;
  y: number;
}

const P = {
  left: { set: { x: 196, y: 112 }, hit: { x: 78, y: 104 }, setBase: 196, hitBase: 74 },
  right: { set: { x: 284, y: 112 }, hit: { x: 402, y: 104 }, setBase: 284, hitBase: 406 },
} as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const back = (s: Side): Strk => (s === "left" ? "Lh" : "Rh");
const front = (s: Side): Strk => (s === "left" ? "Ls" : "Rs");

export default function CourtGame() {
  const ballRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const raf = useRef<number>(0); // ball animation
  const craf = useRef<number>(0); // charge loop
  const mraf = useRef<number>(0); // pass marker loop
  const running = useRef(false);
  const paused = useRef(false);
  const meterRef = useRef<Meter>(null);
  const power = useRef(0);
  const combo = useRef(0); // consecutive fast taps
  const lastTap = useRef(0);
  const zone = useRef<[number, number]>([60, 78]); // random green zone this spike
  const markerVal = useRef(0);
  const passClaimed = useRef(false);
  const ballPos = useRef<Pt>({ ...P.right.hit });

  const [playing, setPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [striker, setStriker] = useState<Strk>(null);
  const [meter, setMeterState] = useState<Meter>(null);
  const [powerPct, setPowerPct] = useState(0);
  const [zonePct, setZonePct] = useState<[number, number]>([60, 78]);
  const [markerPct, setMarkerPct] = useState(0);
  const [score, setScore] = useState(0);
  const [lost, setLost] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<Side | null>(null);

  function setMeter(m: Meter) {
    meterRef.current = m;
    setMeterState(m);
  }

  function place(x: number, y: number, spin = 0) {
    ballPos.current = { x, y };
    ballRef.current?.setAttribute("transform", `translate(${x} ${y}) rotate(${spin})`);
    if (shadowRef.current) {
      const height = Math.max(0, GROUND - y);
      const k = clamp(1 - height / 170, 0.15, 1);
      shadowRef.current.setAttribute("cx", String(x));
      shadowRef.current.setAttribute("rx", String(12 * k));
      shadowRef.current.setAttribute("ry", String(3.4 * k));
      shadowRef.current.setAttribute("opacity", String(0.3 * k));
    }
  }

  useEffect(() => {
    place(P.right.hit.x, P.right.hit.y);
    return () => {
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(craf.current);
      cancelAnimationFrame(mraf.current);
    };
  }, []);

  function arc(from: Pt, to: Pt, h: number, dur: number, hitter: Strk, done: () => void) {
    cancelAnimationFrame(raf.current);
    setStriker(hitter);
    let t0 = performance.now();
    let last = t0;
    const step = (now: number) => {
      if (paused.current) {
        t0 += now - last;
        last = now;
        raf.current = requestAnimationFrame(step);
        return;
      }
      last = now;
      let t = (now - t0) / dur;
      if (t > 1) t = 1;
      const x = lerp(from.x, to.x, t);
      const y = lerp(from.y, to.y, t) - h * Math.sin(Math.PI * t);
      place(x, y, (now * 0.6) % 360);
      if (t < 1) raf.current = requestAnimationFrame(step);
      else if (running.current) done();
    };
    raf.current = requestAnimationFrame(step);
  }

  function flash(text: string) {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 2200);
  }

  function stopMarker() {
    cancelAnimationFrame(mraf.current);
    mraf.current = 0;
  }

  // PASS marker: sweeps 0→100 across the serve flight; click in the green.
  function startPassMarker(dur: number) {
    markerVal.current = 0;
    setMarkerPct(0);
    let t0 = performance.now();
    let last = t0;
    const loop = (now: number) => {
      if (!running.current) return;
      if (paused.current) {
        t0 += now - last;
        last = now;
        mraf.current = requestAnimationFrame(loop);
        return;
      }
      last = now;
      const v = clamp(((now - t0) / dur) * 100, 0, 100);
      markerVal.current = v;
      setMarkerPct(v);
      if (v < 100) mraf.current = requestAnimationFrame(loop);
    };
    mraf.current = requestAnimationFrame(loop);
  }

  // --- rally flow ------------------------------------------------------------
  // Ball comes over to your side; you time the pass, then set + spike.
  function receive(from: Pt, hitter: Strk) {
    running.current = true;
    passClaimed.current = false;
    setMeter("pass");
    startPassMarker(SERVE_DUR);
    arc(from, P.left.hit, 92, SERVE_DUR, hitter, () => {
      stopMarker();
      setMeter(null);
      if (passClaimed.current) {
        // good pass → bump to setter, who sets it back for your spike.
        arc(P.left.hit, P.left.set, 48, 440, back("left"), () =>
          arc(P.left.set, P.left.hit, 54, 440, front("left"), () => startCharge())
        );
      } else {
        shank(P.left.hit); // never hit the green
      }
    });
  }

  function cpuServe() {
    setMsg(null);
    place(P.right.hit.x, P.right.hit.y);
    receive(P.right.hit, back("right"));
  }

  // Bad taps don't penalise — you can keep trying until the marker leaves green.
  function onPassClick() {
    if (passClaimed.current) return;
    if (markerVal.current >= PASS_GREEN[0] && markerVal.current <= PASS_GREEN[1]) {
      passClaimed.current = true;
      stopMarker();
    }
  }

  // Spike charge: random green zone + random per-tap weight. Stop your fill
  // inside the green (overshoot bricks it). Auto-releases at the window's end.
  function startCharge() {
    if (!running.current) return;
    power.current = 0;
    combo.current = 0;
    lastTap.current = 0;
    setPowerPct(0);
    // new random green zone each spike
    const lo = ZONE_MIN + Math.random() * (ZONE_MAX - ZONE_MIN);
    const w = ZONE_W_MIN + Math.random() * (ZONE_W_MAX - ZONE_W_MIN);
    zone.current = [lo, Math.min(lo + w, 100)];
    setZonePct(zone.current);
    setMeter("spike");
    setStriker(back("left"));
    let prev = performance.now();
    let startT = prev;
    const loop = (now: number) => {
      if (!running.current) return;
      if (paused.current) {
        startT += now - prev;
        prev = now;
        craf.current = requestAnimationFrame(loop);
        return;
      }
      const dt = now - prev;
      prev = now;
      // drain toward 0 while you're not tapping
      power.current = clamp(power.current - DECAY * dt, 0, 100);
      setPowerPct(power.current);
      if (now - startT >= CHARGE_MS) {
        resolveSpike();
        return;
      }
      craf.current = requestAnimationFrame(loop);
    };
    craf.current = requestAnimationFrame(loop);
  }

  function addPower() {
    // rapid consecutive taps build a combo → each tap adds more.
    const now = performance.now();
    combo.current = now - lastTap.current < COMBO_MS ? combo.current + 1 : 0;
    lastTap.current = now;
    const gain = Math.min(TAP_GAIN + combo.current * TAP_RAMP, TAP_CAP);
    power.current = clamp(power.current + gain, 0, 100);
    setPowerPct(power.current);
  }

  function resolveSpike() {
    setMeter(null);
    const [lo, hi] = zone.current;
    const p = power.current;
    if (p >= lo && p <= hi) {
      const center = (lo + hi) / 2;
      const perfect = Math.abs(p - center) <= (hi - lo) * 0.28; // dead-center
      doKill(perfect); // green → hits the ground
    } else if (p >= lo - YELLOW_M && p <= hi + YELLOW_M) {
      dugRally(); // yellow → the CPU passer digs it up
    } else {
      netMiss(); // way off → into the net
    }
  }

  function doKill(perfect: boolean) {
    const tx = 300 + Math.random() * 130;
    arc(P.left.hit, { x: tx, y: 183 }, 92, 560, back("left"), () => {
      setStriker(null);
      const bx = clamp(tx + 18, 255, 466);
      arc({ x: tx, y: 183 }, { x: bx, y: 184 }, 22, 320, null, () => {
        setScore((s) => s + 1);
        flash(perfect ? "PERFECT KILL! 🔥" : "KILL! 💥");
        celebrateThenServe("left");
      });
    });
  }

  function netMiss() {
    arc(P.left.hit, { x: 232, y: 112 }, 34, 420, back("left"), () => {
      setStriker(null);
      arc({ x: 232, y: 112 }, { x: 232, y: 183 }, 0, 360, null, () => {
        setLost((l) => l + 1);
        flash("RALLY LOST");
        celebrateThenServe("right");
      });
    });
  }

  // Yellow: decent spike, but the CPU digs it and plays out their side, then
  // attacks back over — you have to pass and spike again (rally continues).
  function dugRally() {
    flash("DUG!");
    // 1. your spike crosses to the CPU backrow, who digs it up
    arc(P.left.hit, P.right.hit, 88, 560, back("left"), () => {
      // 2. CPU backrow passes to its setter
      arc(P.right.hit, P.right.set, 48, 440, back("right"), () =>
        // 3. CPU setter sets it back
        arc(P.right.set, P.right.hit, 54, 440, front("right"), () =>
          // 4. CPU backrow attacks over → you receive again
          receive(P.right.hit, back("right"))
        )
      );
    });
  }

  function shank(from: Pt) {
    arc(from, { x: 120, y: 184 }, 22, 460, back("left"), () => {
      setStriker(null);
      setLost((l) => l + 1);
      flash("RALLY LOST");
      celebrateThenServe("right");
    });
  }

  function celebrateThenServe(winner: Side) {
    setCelebrate(winner);
    window.setTimeout(() => {
      setCelebrate(null);
      if (running.current) cpuServe();
    }, 4200);
  }

  function start() {
    running.current = true;
    paused.current = false;
    setIsPaused(false);
    setPlaying(true);
    cpuServe();
  }
  function stop() {
    running.current = false;
    paused.current = false;
    cancelAnimationFrame(raf.current);
    cancelAnimationFrame(craf.current);
    stopMarker();
    setPlaying(false);
    setIsPaused(false);
    setMeter(null);
    setStriker(null);
    setMsg(null);
    setCelebrate(null);
    place(P.right.hit.x, P.right.hit.y);
  }
  function togglePause() {
    if (!playing) return;
    paused.current = !paused.current;
    setIsPaused(paused.current);
  }

  function onTap() {
    if (paused.current) return;
    if (meterRef.current === "pass") onPassClick();
    else if (meterRef.current === "spike") addPower();
  }

  function Player({ id, base, face }: { id: Exclude<Strk, null>; base: number; face: 1 | -1 }) {
    const pside: Side = id[0] === "L" ? "left" : "right";
    const cheering = celebrate === pside;
    const armsUp = striker === id || cheering;
    return (
      <g transform={`translate(${base} 0)`} fill="#2f3a34">
        <g className={cheering ? "animate-celebrate" : ""}>
          <rect x={-7} y={162} width={5} height={26} rx={2.5} />
          <rect x={2} y={162} width={5} height={26} rx={2.5} />
          <rect x={-8} y={132} width={16} height={34} rx={7} />
          <circle cx={0} cy={124} r={8} />
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center bottom",
              transform: armsUp ? `rotate(${(cheering ? -1 : face) * -60}deg)` : "rotate(0deg)",
              transition: "transform 120ms ease-out",
            }}
          >
            <rect x={face === 1 ? 4 : -14} y={134} width={10} height={7} rx={3.5} />
          </g>
        </g>
      </g>
    );
  }

  return (
    <div className="rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-sm font-extrabold text-slate-700">🏐 Rally</h2>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
          <span>
            You <span className="tabular-nums text-emerald-600">{score}</span>
            <span className="mx-1 text-slate-400">·</span>
            CPU <span className="tabular-nums text-rose-600">{lost}</span>
          </span>
          <span className="font-medium text-slate-500">
            {isPaused
              ? "paused"
              : meter === "pass"
              ? "TAP TO PASS!"
              : meter === "spike"
              ? "TAP FAST!"
              : playing
              ? "rallying…"
              : "press Start"}
          </span>
        </div>
      </div>

      {/* controls */}
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={start}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
        >
          {playing ? "Restart" : "Start game"}
        </button>
        <button
          type="button"
          onClick={togglePause}
          disabled={!playing}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-600 disabled:opacity-40"
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
      </div>

      {/* spike charge bar (pass has no bar — it's a timing tap) */}
      {meter === "spike" && !isPaused && (
        <div className="mb-2 cursor-pointer" onClick={addPower}>
          <div className="relative h-5 w-full overflow-hidden rounded-full bg-slate-300/70 ring-1 ring-white/60">
            {/* yellow (dug) band around the green (moves every spike) */}
            <div
              className="absolute inset-y-0 bg-amber-400/35"
              style={{
                left: `${Math.max(0, zonePct[0] - YELLOW_M)}%`,
                width: `${Math.min(100, zonePct[1] + YELLOW_M) - Math.max(0, zonePct[0] - YELLOW_M)}%`,
              }}
            />
            {/* green (kill) zone */}
            <div
              className="absolute inset-y-0 border-x-2 border-green-600/80 bg-green-500/45"
              style={{ left: `${zonePct[0]}%`, width: `${zonePct[1] - zonePct[0]}%` }}
            />
            {/* your fill */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400/90 to-red-500/90"
              style={{ width: `${powerPct}%` }}
            />
          </div>
          <p className="mt-1 text-center text-[11px] font-bold text-slate-700">
            tap to raise, stop to drop · green = KILL 🔥 · yellow = dug
          </p>
        </div>
      )}
      {/* pass timing bar — wide green, forgiving */}
      {meter === "pass" && !isPaused && (
        <div className="mb-2 cursor-pointer" onClick={onPassClick}>
          <div className="relative h-5 w-full overflow-hidden rounded-full bg-slate-300/70 ring-1 ring-white/60">
            <div
              className="absolute inset-y-0 bg-sky-500/30 border-x-2 border-sky-600/70"
              style={{ left: `${PASS_GREEN[0]}%`, width: `${PASS_GREEN[1] - PASS_GREEN[0]}%` }}
            />
            <div
              className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-slate-900"
              style={{ left: `${markerPct}%` }}
            />
          </div>
          <p className="mt-1 text-center text-[11px] font-bold text-sky-700">
            click while the marker is in the blue to PASS 🏐
          </p>
        </div>
      )}

      <div className="relative">
        {msg && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
            <span
              className={`animate-pop-in rounded-full px-5 py-1.5 font-display text-xl font-extrabold text-white shadow-lg ${
                msg.includes("LOST")
                  ? "bg-rose-600"
                  : msg.includes("DUG")
                  ? "bg-amber-500"
                  : "bg-emerald-600"
              }`}
            >
              {msg}
            </span>
          </div>
        )}
        {isPaused && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="rounded-full bg-slate-900/70 px-5 py-1.5 font-display text-lg font-extrabold text-white">
              Paused
            </span>
          </div>
        )}

        <svg
          viewBox="0 0 480 210"
          className="w-full cursor-pointer select-none"
          onClick={onTap}
          role="img"
          aria-label="Volleyball: tap to pass when the ball is close, then tap fast to charge your spike."
        >
          <defs>
            <linearGradient id="courtSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bfe3ff" />
              <stop offset="60%" stopColor="#dff1ff" />
            </linearGradient>
            <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4e4bf" />
              <stop offset="100%" stopColor="#e8cf95" />
            </linearGradient>
            <pattern id="netMeshCourt" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M6 0H0V6" fill="none" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={0.8} />
            </pattern>
          </defs>

          <rect x={0} y={0} width={480} height={210} rx={12} fill="url(#courtSky)" />

          <polygon points="150,120 330,120 470,196 10,196" fill="url(#sand)" />
          <polygon points="150,120 330,120 470,196 10,196" fill="none" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={2} />
          <line x1={NET_X} y1={120} x2={NET_X} y2={196} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={2} />

          {/* net */}
          <line x1={NET_X} y1={NET_TOP} x2={NET_X} y2={GROUND} stroke="#6f6f6f" strokeWidth={3} />
          <rect x={NET_X - 6} y={NET_TOP + 4} width={12} height={NET_BOTTOM - NET_TOP} fill="url(#netMeshCourt)" />
          <rect x={NET_X - 7} y={NET_TOP} width={14} height={5} rx={1.5} fill="#ffffff" opacity={0.92} />
          <rect x={NET_X - 6} y={NET_BOTTOM} width={12} height={2.5} fill="#ffffff" opacity={0.7} />

          {/* persistent "YOU" tag over your character (left backrow) */}
          {playing && (
            <g transform={`translate(${P.left.hitBase} 86)`}>
              <rect x={-14} y={-9} width={28} height={13} rx={6.5} fill="#059669" />
              <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={800} fill="#ffffff">
                YOU
              </text>
              <path d="M-4 4 L4 4 L0 9 Z" fill="#059669" />
            </g>
          )}

          {/* diamond over the player you're acting for */}
          {(meter === "pass" || meter === "spike") && (
            <g className="animate-bob" transform={`translate(${P.left.hitBase} 100)`}>
              <path
                d="M0 -9 L8 0 L0 9 L-8 0 Z"
                fill={meter === "pass" ? "#38bdf8" : "#fbbf24"}
                stroke={meter === "pass" ? "#0284c7" : "#f59e0b"}
                strokeWidth={1.4}
              />
            </g>
          )}

          <Player id="Lh" base={P.left.hitBase} face={1} />
          <Player id="Ls" base={P.left.setBase} face={1} />
          <Player id="Rs" base={P.right.setBase} face={-1} />
          <Player id="Rh" base={P.right.hitBase} face={-1} />

          <ellipse ref={shadowRef} cx={P.right.hit.x} cy={GROUND + 14} rx={12} ry={3.4} fill="#000" opacity={0.3} />

          <g ref={ballRef} role="button" aria-label="Ball">
            <circle r={20} fill="transparent" />
            <circle r={12} fill="#fbfaf6" stroke="#c9a24a" strokeWidth={1.6} />
            <path
              d="M-12 0 A12 12 0 0 1 12 0 M0 -12 A15 15 0 0 0 0 12 M-9 -8 A17 17 0 0 0 9 -8"
              fill="none"
              stroke="#c9a24a"
              strokeWidth={1}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
