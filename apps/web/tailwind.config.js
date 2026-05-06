/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "var(--pv-p50)",
          100: "var(--pv-p100)",
          200: "var(--pv-p200)",
          300: "var(--pv-p300)",
          400: "var(--pv-p400)",
          500: "var(--pv-p500)",
          600: "var(--pv-p600)",
          700: "var(--pv-p700)",
          800: "var(--pv-p800)",
          900: "var(--pv-p900)",
        },
        /** Evitar tinte azul en modo oscuro: grises neutros (no slate “frío”) */
        slate: {
          850: "#27272a",
          950: "#09090b",
        },
      },
    },
  },
  plugins: [],
};
