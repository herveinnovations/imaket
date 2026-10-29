import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", lg: "1.25rem" }, screens: { "2xl": "1440px" } },
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          fg: "rgb(var(--brand-fg) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
        },
        accent: "rgb(var(--accent) / <alpha-value>)",
        lime: "rgb(var(--lime) / <alpha-value>)",
        stone: "rgb(var(--stone) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Arial", "var(--font-arimo)", "Helvetica", "sans-serif"],
        display: ['"Arial Black"', "var(--font-archivo)", '"Arial Bold"', "Arial", "sans-serif"],
      },
      // Square corners everywhere (Wix Harmony streetwear template); pills stay rounded-full.
      borderRadius: { none: "0", sm: "0", DEFAULT: "0", md: "0", lg: "0", xl: "0", "2xl": "0", "3xl": "0", full: "9999px" },
      boxShadow: {
        card: "none",
        lift: "0 12px 40px -12px rgb(0 0 0 / 0.25)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        "slide-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        marquee: "marquee 40s linear infinite",
        "slide-up": "slide-up 0.35s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
