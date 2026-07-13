"use client";

import { useEffect, useRef, useState } from "react";

// Side-on beach court, a frontrow (setter, near net) + backrow (passer/hitter)
// player each side. Tap the ball to serve, then it rallies realistically:
//   backrow passes → frontrow sets it back → backrow attacks over the net.
// On YOUR side (left) the attack is a power meter: tap fast to fill it — land
// it in the green before the ball goes over and it's a KILL (steep spike +
// point). Miss and it's a normal send-over; the right side plays on (auto).
//
// Ball motion is JS/rAF-driven; its transform is written imperatively via ref
// so React re-renders never fight the animation. Tap the ball again to stop.

const GROUND = 188;
const NET_X = 240;
const NET_TOP = 66;
const NET_BOTTOM = 138;

const CHARGE_MS = 1400; // window to fill the meter
const TAP_GAIN = 15; // power per tap
const DECAY = 0.03; // power lost per ms (rewards fast tapping)
const GREEN = 70; // kill threshold
const PERFECT = 92;

type Side = "left" | "right";
type Strk = "Ls" | "Lh" | "Rs" | "Rh" | null;

interface Pt {
  x: number;
  y: number;
}

// set = frontrow (near net), hit = backrow (at the back).
const P = {
  left: { set: { x: 196, y: 112 }, hit: { x: 78, y: 104 }, setBase: 196, hitBase: 74 },
  right: { set: { x: 284, y: 112 }, hit: { x: 402, y: 104 }, setBase: 284, hitBase: 406 },
} as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const opp = (s: Side): Side => (s === "left" ? "right" : "left");
const front = (s: Side): Strk => (s === "left" ? "Ls" : "Rs");
const back = (s: Side): Strk => (s === "left" ? "Lh" : "Rh");

export default function CourtGame() {
  const ballRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const raf = useRef<number>(0);
  const running = useRef(false);
  const charging = useRef(false);
  const power = useRef(0);
  const paused = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [striker, setStriker] = useState<Strk>(null);
  const [showMeter, setShowMeter] = useState(false);
  const [powerPct, setPowerPct] = useState(0);
  const [score, setScore] = useState(0); // your kills
  const [lost, setLost] = useState(0); // rallies you lost
  const [msg, setMsg] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<Side | null>(null);

  function place(x: number, y: number, spin = 0) {
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
    return () => cancelAnimationFrame(raf.current);
  }, []);

  function arc(from: Pt, to: Pt, h: number, dur: number, hitter: Strk, done: () => void) {
    cancelAnimationFrame(raf.current);
    setStriker(hitter);
    let t0 = performance.now();
    let last = t0;
    const step = (now: number) => {
      // While paused, freeze progress (shift the clock) but keep polling.
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

  // --- rally state machine ---------------------------------------------------
  function pass(side: Side) {
    if (!running.current) return;
    arc(P[side].hit, P[side].set, 48, 440, back(side), () => set(side));
  }
  function set(side: Side) {
    if (!running.current) return;
    arc(P[side].set, P[side].hit, 54, 440, front(side), () =>
      side === "left" ? beginCharge() : sendOver(side)
    );
  }
  function sendOver(side: Side) {
    if (!running.current) return;
    arc(P[side].hit, P[opp(side)].hit, 90, 720, back(side), () => pass(opp(side)));
  }

  // Your attack: charge the power meter, then resolve to kill or normal hit.
  function beginCharge() {
    if (!running.current) return;
    charging.current = true;
    power.current = 0;
    setPowerPct(0);
    setShowMeter(true);
    setStriker(back("left")); // backrow poised to swing
    let prev = performance.now();
    let startT = prev;
    const loop = (now: number) => {
      if (!running.current) return;
      // Paused: don't drain power or count the window.
      if (paused.current) {
        startT += now - prev;
        prev = now;
        raf.current = requestAnimationFrame(loop);
        return;
      }
      const dt = now - prev;
      prev = now;
      power.current = clamp(power.current - DECAY * dt, 0, 100);
      setPowerPct(power.current);
      if (now - startT >= CHARGE_MS) {
        resolveAttack();
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }

  function addPower() {
    if (!charging.current) return;
    power.current = clamp(power.current + TAP_GAIN, 0, 100);
    setPowerPct(power.current);
  }

  function resolveAttack() {
    charging.current = false;
    setShowMeter(false);
    const p = power.current;
    if (p >= GREEN) {
      const perfect = p >= PERFECT;
      const tx = 300 + Math.random() * 130; // land deep in the far court (past the net)
      // Spike up over the net then down onto the far-side sand; one small bounce.
      arc(P.left.hit, { x: tx, y: 183 }, 92, 560, back("left"), () => {
        setStriker(null);
        const bx = clamp(tx + 18, 255, 466);
        arc({ x: tx, y: 183 }, { x: bx, y: 184 }, 22, 320, null, () => {
          setScore((s) => s + 1);
          flash(perfect ? "PERFECT KILL! 🔥" : "KILL! 💥");
          celebrateThenServe("left"); // left team won the point → they serve next
        });
      });
    } else {
      // missed the green → weak attack hits the net and drops straight down.
      arc(P.left.hit, { x: 232, y: 112 }, 34, 420, back("left"), () => {
        setStriker(null);
        // dead drop down the net (h = 0 → straight fall), then settle.
        arc({ x: 232, y: 112 }, { x: 232, y: 183 }, 0, 360, null, () => {
          setLost((l) => l + 1);
          flash("RALLY LOST");
          celebrateThenServe("right"); // right team won the point → they serve next
        });
      });
    }
  }

  // Winners bounce/cheer, brief pause, then the winning team serves.
  function celebrateThenServe(winner: Side) {
    setCelebrate(winner);
    window.setTimeout(() => {
      setCelebrate(null);
      if (running.current) start(winner);
    }, 4200);
  }

  function start(server: Side = "right") {
    running.current = true;
    paused.current = false;
    setIsPaused(false);
    setPlaying(true);
    setMsg(null);
    // server's backrow serves over the net to the receiving backrow.
    const recv = opp(server);
    place(P[server].hit.x, P[server].hit.y);
    arc(P[server].hit, P[recv].hit, 92, 760, back(server), () => pass(recv));
  }
  function stop() {
    running.current = false;
    charging.current = false;
    paused.current = false;
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    setIsPaused(false);
    setShowMeter(false);
    setStriker(null);
    setMsg(null);
    place(P.right.hit.x, P.right.hit.y);
  }
  function togglePause() {
    if (!playing) return;
    paused.current = !paused.current;
    setIsPaused(paused.current);
  }

  // Tap the court: charge the meter (only useful action during play).
  function onTap() {
    if (charging.current && !paused.current) addPower();
  }

  function Player({
    id,
    base,
    face,
  }: {
    id: Exclude<Strk, null>;
    base: number;
    face: 1 | -1;
  }) {
    const pside: Side = id[0] === "L" ? "left" : "right";
    const cheering = celebrate === pside;
    const armsUp = striker === id || cheering;
    return (
      <g transform={`translate(${base} 0)`} fill="#2f3a34">
        {/* inner wrapper takes the celebration jump (CSS transform) so it
            doesn't override the position transform on the outer group */}
        <g className={cheering ? "animate-celebrate" : ""}>
          <rect x={-7} y={162} width={5} height={26} rx={2.5} />
          <rect x={2} y={162} width={5} height={26} rx={2.5} />
          <rect x={-8} y={132} width={16} height={34} rx={7} />
          <circle cx={0} cy={124} r={8} />
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center bottom",
              transform: armsUp
                ? `rotate(${(cheering ? -1 : face) * -60}deg)`
                : "rotate(0deg)",
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
              : showMeter
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
          onClick={() => start("right")}
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

      {/* power meter */}
      {showMeter && !isPaused && (
        <div className="mb-2 cursor-pointer" onClick={addPower}>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-300/70 ring-1 ring-white/60">
            {/* green kill zone (70–100%) */}
            <div className="absolute inset-y-0 right-0 w-[30%] border-l-2 border-green-600/70 bg-green-500/25" />
            {/* fill */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-red-500"
              style={{ width: `${powerPct}%` }}
            />
          </div>
          <p className="mt-1 text-center text-[11px] font-bold text-slate-700">
            tap into the green to KILL 🔥
          </p>
        </div>
      )}

      <div className="relative">
      {/* big result banner — clearly visible */}
      {msg && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
          <span
            className={`animate-pop-in rounded-full px-5 py-1.5 font-display text-xl font-extrabold text-white shadow-lg ${
              msg.includes("LOST") ? "bg-rose-600" : "bg-emerald-600"
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
        aria-label="Two-a-side volleyball rally with a power-meter spike. Tap to serve, tap fast to power your kill."
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

        {/* perspective court */}
        <polygon points="150,120 330,120 470,196 10,196" fill="url(#sand)" />
        <polygon points="150,120 330,120 470,196 10,196" fill="none" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={2} />
        <line x1={NET_X} y1={120} x2={NET_X} y2={196} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={2} />

        {/* net — side-on: a vertical mesh strip on a center pole */}
        <line x1={NET_X} y1={NET_TOP} x2={NET_X} y2={GROUND} stroke="#6f6f6f" strokeWidth={3} />
        <rect x={NET_X - 6} y={NET_TOP + 4} width={12} height={NET_BOTTOM - NET_TOP} fill="url(#netMeshCourt)" />
        <rect x={NET_X - 7} y={NET_TOP} width={14} height={5} rx={1.5} fill="#ffffff" opacity={0.92} />
        <rect x={NET_X - 6} y={NET_BOTTOM} width={12} height={2.5} fill="#ffffff" opacity={0.7} />

        {/* diamond marker over the player the meter is charging for */}
        {showMeter && (
          <g className="animate-bob" transform={`translate(${P.left.hitBase} 100)`}>
            <path d="M0 -9 L8 0 L0 9 L-8 0 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth={1.4} />
          </g>
        )}

        {/* players */}
        <Player id="Lh" base={P.left.hitBase} face={1} />
        <Player id="Ls" base={P.left.setBase} face={1} />
        <Player id="Rs" base={P.right.setBase} face={-1} />
        <Player id="Rh" base={P.right.hitBase} face={-1} />

        {/* ball shadow */}
        <ellipse ref={shadowRef} cx={P.right.hit.x} cy={GROUND + 14} rx={12} ry={3.4} fill="#000" opacity={0.3} />

        {/* ball */}
        <g ref={ballRef} role="button" aria-label="Serve the ball">
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
