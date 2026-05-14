/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        spotify: {
          DEFAULT: '#1db954',
          dark: '#179443',
          light: '#1ed760',
        },
        ink: {
          950: '#050608',
          900: '#0a0c10',
          800: '#0f1219',
          700: '#14181f',
          600: '#1a1d24',
          500: '#232733',
          400: '#2a2f3a',
          300: '#3b4252',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px #1db954, 0 0 18px rgba(29,185,84,0.35)',
        'card-lg': '0 12px 32px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        eq: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(29,185,84,0.45)' },
          '70%': { boxShadow: '0 0 0 12px rgba(29,185,84,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(29,185,84,0)' },
        },
      },
      animation: {
        eq1: 'eq 0.9s ease-in-out infinite',
        eq2: 'eq 0.7s ease-in-out infinite 0.15s',
        eq3: 'eq 1.1s ease-in-out infinite 0.3s',
        eq4: 'eq 0.8s ease-in-out infinite 0.45s',
        eq5: 'eq 1.0s ease-in-out infinite 0.6s',
        'spin-slow': 'spin 8s linear infinite',
        'pulse-ring': 'pulseRing 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
