/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'cursive'],
        'terminal': ['"VT323"', 'monospace'],
      },
      colors: {
        'farm-green': '#8bac0f',
        'farm-dark': '#0f380f',
        'soil': '#8b4513',
        'danger': '#e53e3e',
        'gold': '#ecc94b',
      }
    },
  },
  plugins: [],
}
