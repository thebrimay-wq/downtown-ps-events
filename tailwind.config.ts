import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        // "Golden Hour": Pleasanton's own palette — bone, espresso, terracotta,
        // gold — held to a precise system. Colour is warm; structure is strict.
        ink: {
          DEFAULT: "#2A1F16",
          soft: "#4A3D32",
          muted: "#6F6052",
          faint: "#9A8B7C",
        },
        canvas: {
          DEFAULT: "#FBF8F3",
          raised: "#FFFFFF",
          sunken: "#F3EEE6",
        },
        // Terracotta. 500 is the true hue, for fills and the gradient; 600 is
        // the darkest step that still reads as terracotta, and it clears AA as
        // text on bone and under white text, so it carries all the copy.
        brand: {
          50: "#FCF3EE",
          100: "#F8E3D8",
          200: "#F0C4AE",
          300: "#E49A78",
          400: "#D4744C",
          500: "#C2542D",
          600: "#AE4624",
          700: "#9C3E20",
          800: "#7E321B",
          900: "#622716",
        },
        // Gold. Decorative — the gradient, a hairline, a highlight. Never text.
        accent: {
          100: "#FBF0D6",
          200: "#F3DDA5",
          400: "#E3B45C",
          500: "#D9A441",
          600: "#B8862E",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        // Contact + ambient, both warm-tinted so they sit on bone naturally.
        card: "0 1px 2px rgba(42,31,22,0.05), 0 10px 28px -16px rgba(42,31,22,0.28)",
        "card-hover": "0 2px 4px rgba(42,31,22,0.06), 0 20px 44px -20px rgba(42,31,22,0.36)",
        float: "0 24px 64px -28px rgba(42,31,22,0.40)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "warm-in": {
          "0%": { opacity: "0", transform: "scale(1.04) translateY(-2%)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "warm-in": "warm-in 1.6s cubic-bezier(0.16, 1, 0.3, 1) both",
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
