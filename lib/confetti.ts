// Tiny dependency-free confetti burst — spawns emoji that fall and fade, then
// clean themselves up. Used when a green day is clicked ("spike!").

const PIECES = ["🏐", "🎉", "✨", "🟢"];

export function spikeConfetti(x: number, y: number): void {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const n = 18;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("span");
    el.textContent = PIECES[i % PIECES.length];
    const angle = (Math.PI * (0.15 + Math.random() * 0.7)) * -1; // upward-ish
    const dist = 80 + Math.random() * 120;
    const dx = Math.cos(angle) * dist * (Math.random() < 0.5 ? -1 : 1);
    const dy = Math.sin(angle) * dist - 60;

    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:50;
      pointer-events:none;font-size:${14 + Math.random() * 14}px;
      will-change:transform,opacity;transition:transform .9s cubic-bezier(.2,.6,.3,1),opacity .9s ease-out;`;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate(${dx}px, ${dy + 160}px) rotate(${
        Math.random() * 540 - 270
      }deg)`;
      el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 1000);
  }
}
