/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
    "./data/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}"
  ],
  safelist: [
    // Theme background + text colors generated dynamically
    { pattern: /bg-gradient-to-br/ },
    { pattern: /from-.*/ },
    { pattern: /to-.*/ },
    { pattern: /text-.*/ },
    { pattern: /bg-\[url\("\/.*"\)\]/ }
  ],
  theme: {
    extend: {
      colors: {
        madfill: {
          dark: '#0f172a', // Slate-900
          accent: '#9333ea', // Purple-600
          glow: '#facc15',   // Yellow-400
        }
      },
      backgroundImage: {
        'parchment-texture': "url('/parchment-texture.PNG')",
        'clouds-texture': "url('/clouds-texture.PNG')",
      }
    },
  },
  darkMode: 'media', // or 'class'
  plugins: [],
}
