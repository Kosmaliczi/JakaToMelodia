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
          900: '#0a0c10',
          800: '#0f1219',
          700: '#14181f',
          600: '#1a1d24',
          500: '#232733',
          400: '#2a2f3a',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px #1db954, 0 0 18px rgba(29,185,84,0.35)',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
