/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'award': {
          light: '#dcfce7',
          DEFAULT: '#22c55e',
          dark: '#15803d',
        },
        'solicitation': {
          light: '#dbeafe',
          DEFAULT: '#3b82f6',
          dark: '#1d4ed8',
        },
        'ja': {
          light: '#ffedd5',
          DEFAULT: '#f97316',
          dark: '#c2410c',
        },
        'naics': {
          light: '#f3e8ff',
          DEFAULT: '#a855f7',
          dark: '#7e22ce',
        }
      }
    },
  },
  plugins: [],
}
