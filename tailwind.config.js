/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        barber: {
          gold: '#d4af37',
          dark: '#0a0a0a',
          card: '#141414',
          border: '#262626',
          neon: '#00ff66'
        }
      }
    },
  },
  plugins: [],
}