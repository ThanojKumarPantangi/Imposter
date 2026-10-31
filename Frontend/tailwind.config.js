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
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite'
      },
      keyframes: {
        glowPulse: {
          '0%': { boxShadow: '0 0 15px rgba(244, 63, 94, 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(244, 63, 94, 0.8)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' }
        }
      }
    },
  },
  plugins: [],
}
