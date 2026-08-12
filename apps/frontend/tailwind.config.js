// [apps/frontend] tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // "Soft lifted layers": tight contact shadow + wide diffuse ambient so
        // cards float gently off the mesh background (see DESIGN.md → Elevation).
        card: "0 1px 2px rgba(16, 24, 40, 0.05), 0 12px 32px -8px rgba(16, 24, 40, 0.10)",
        // Popovers, dropdowns, and modal panels above the page.
        overlay: "0 16px 40px -12px rgba(16, 24, 40, 0.16)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};
