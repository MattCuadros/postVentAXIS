import type { Config } from "tailwindcss";

/** Tokens Axis — Manual de Marca 2024 v3 (skill formato-axis). */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Marca
        accent: { DEFAULT: "#003399", hover: "#002B82", active: "#00246B", soft: "#E6ECF7" }, // Azul Axis
        brand: { orange: "#FF6600", "orange-soft": "#FFF0E6", "orange-ink": "#A84300", gray: "#CCCCCC" },
        // Superficies y texto
        surface: { DEFAULT: "#FFFFFF", secondary: "#F2F2F2", warm: "#F7F7F7", dark: "#1E1E1E" },
        ink: { DEFAULT: "#1A1A1A", secondary: "#4D4D4D", muted: "#737373", meta: "#737373" },
        line: { DEFAULT: "#CCCCCC", soft: "#E6E6E6" },
        // Estados (el naranjo NO se usa para error)
        success: "#1E8E3E",
        warning: "#B26A00",
        danger: "#C62828",
      },
      fontFamily: {
        display: ["'Helvetica Neue'", "Helvetica", "Arial", "sans-serif"],
        sans: ["'Helvetica Neue'", "Helvetica", "Arial", "sans-serif"],
      },
      fontSize: {
        xs: ["12px", "1.4"],
        sm: ["14px", "1.45"],
        base: ["16px", "1.5"],
        lg: ["20px", "1.35"],
        xl: ["24px", "1.25"],
        "2xl": ["32px", "1.2"],
        "3xl": ["44px", "1.1"],
        "4xl": ["60px", "1.05"],
      },
      borderRadius: { sm: "6px", md: "10px", lg: "16px", block: "24px", pill: "980px" },
      boxShadow: {
        card: "0 1px 2px rgba(0,31,92,0.05), 0 5px 14px rgba(0,31,92,0.06)",
        raised: "0 16px 40px rgba(0,31,92,0.16), 0 2px 8px rgba(0,31,92,0.10)",
      },
      transitionTimingFunction: { "axis-out": "cubic-bezier(0.22, 1, 0.36, 1)" },
      keyframes: {
        "menu-in": { "0%": { opacity: "0", transform: "scale(.96) translateY(-4px)" }, "100%": { opacity: "1", transform: "scale(1) translateY(0)" } },
        "dialog-in": { "0%": { opacity: "0", transform: "scale(.98)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        "backdrop-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
      animation: { "menu-in": "menu-in 150ms cubic-bezier(0.22, 1, 0.36, 1)", "dialog-in": "dialog-in 200ms cubic-bezier(0.22, 1, 0.36, 1)" },
    },
  },
  plugins: [],
};

export default config;
