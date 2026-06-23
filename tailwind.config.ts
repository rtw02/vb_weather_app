import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "var(--font-inter)", "sans-serif"],
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "60%": { transform: "scale(1.04)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        drift: {
          "0%": { transform: "translateX(-220px)" },
          "100%": { transform: "translateX(1420px)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        sway: {
          "0%, 100%": { transform: "skewX(0deg)" },
          "50%": { transform: "skewX(1.4deg)" },
        },
        swaySlow: {
          "0%, 100%": { transform: "rotate(-0.8deg)" },
          "50%": { transform: "rotate(0.8deg)" },
        },
        arc: {
          "0%": { transform: "translate(160px, 360px) rotate(0deg)", opacity: "0" },
          "10%": { opacity: "1" },
          "50%": { transform: "translate(600px, 140px) rotate(360deg)", opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translate(1040px, 370px) rotate(720deg)", opacity: "0" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.45s ease-out both",
        "pop-in": "popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
        "slide-down": "slideDown 0.25s ease-out both",
        shimmer: "shimmer 1.4s linear infinite",
        drift: "drift linear infinite",
        twinkle: "twinkle 3s ease-in-out infinite",
        sway: "sway 6s ease-in-out infinite",
        "sway-slow": "swaySlow 9s ease-in-out infinite",
        arc: "arc 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
