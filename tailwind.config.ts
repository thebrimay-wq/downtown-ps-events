import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      colors: {
        // Warm, local Pleasanton palette: golden hills + clean Apple neutrals.
        ink: {
          DEFAULT: "#1c1c1e",
          soft: "#3a3a3c",
          muted: "#6e6e73",
          faint: "#8e8e93",
        },
        canvas: {
          DEFAULT: "#fbfaf7",
          raised: "#ffffff",
          sunken: "#f2f0ea",
        },
        brand: {
          50: "#fdf6ed",
          100: "#f9e7cc",
          200: "#f2cd99",
          300: "#eaad5e",
          400: "#e3923a",
          500: "#d9791f",
          600: "#c0611a",
          700: "#9d4a1a",
          800: "#7f3c1c",
          900: "#68331b",
        },
        // "Map blue" — reserved for location and wayfinding affordances so it
        // never competes with the orange primary.
        accent: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.12)",
        "card-hover": "0 2px 4px rgba(0,0,0,0.06), 0 16px 40px -16px rgba(0,0,0,0.20)",
        float: "0 12px 48px -16px rgba(0,0,0,0.28)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      transitionTimingFunction: {
        // Enter fast, settle slow — the standard "ease-out" for entering UI.
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
