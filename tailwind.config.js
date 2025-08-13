/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
    "./data/**/*.{js,jsx,ts,tsx}",
    // If you adopt the App Router later, re-enable:
    // "./app/**/*.{js,jsx,ts,tsx}"
  ],
  safelist: [
    // Dynamic theme utilities you use across the app
    { pattern: /bg-gradient-to-br/ },
    { pattern: /from-.*/ },
    { pattern: /to-.*/ },
    { pattern: /text-.*/ },

    // Explicit keys for extended backgrounds (avoids noisy regex warning)
    "bg-parchment-texture",
    "bg-clouds-texture",
  ],
  theme: {
    extend: {
      colors: {
        madfill: {
          dark: "#0f172a",   // Slate-900
          accent: "#9333ea", // Purple-600
          glow: "#facc15",   // Yellow-400
        },
      },
      backgroundImage: {
        "parchment-texture": "url('/parchment-texture.PNG')",
        "clouds-texture": "url('/clouds-texture.PNG')",
      },
    },
  },
  darkMode: "media", // or 'class'
  plugins: [],
};
