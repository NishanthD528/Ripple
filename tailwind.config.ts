import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Restrained B2B palette. Ink + slate + a single trustworthy accent.
        ink: {
          DEFAULT: "#0f172a",
          soft: "#1e293b",
        },
        accent: {
          DEFAULT: "#0f766e", // teal-700, calm and credible
          hover: "#0d5f58",
          soft: "#ccfbf1",
        },
        severity: {
          low: "#0369a1",
          medium: "#b45309",
          high: "#b91c1c",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
