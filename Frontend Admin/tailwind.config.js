/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#07090e',
          900: '#0d1117',
          850: '#131924',
          800: '#161e2e',
          700: '#232d42',
          600: '#334155'
        },
        imposter: {
          DEFAULT: '#f43f5e',
          glow: '#ff1e56',
          dark: '#be123c'
        },
        civilian: {
          DEFAULT: '#06b6d4',
          glow: '#00f2fe',
          dark: '#0e7490'
        },
        accent: {
          purple: '#a855f7',
          amber: '#f59e0b',
          emerald: '#10b981'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}

