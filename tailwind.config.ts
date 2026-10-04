import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          emphasis: '#025ccc',
          emphasisHover: '#014fd3',
          emphasisPressed: '#003eab',
          highlight: '#0072de',
          highlightHover: '#025ccc',
          highlightPressed: '#014fd3',
          hover: '#e6f2ff',
          pressed: '#bcdcff',
        },
        secondary: {
          DEFAULT: '#fff8d6',
          emphasis: '#f59e0b',
          hover: '#fbbf24',
          pressed: '#d97706',
        },
        success: { emphasis: '#059669' },
        attention: { emphasis: '#d97706' },
        danger: { emphasis: '#dc2626' },
        forest: {
          50: '#f0f6fe', 100: '#e1edfe', 200: '#c7ddfd', 300: '#9cbdfb',
          400: '#6895f7', 500: '#3b6cf2', 600: '#224ce6', 700: '#014fd3',
          800: '#0f38a3', 900: '#0f2766', 950: '#091840',
        },
        sand: {
          50: '#fffdf5', 100: '#fff8d6', 200: '#ffef99', 300: '#ffe152',
          400: '#ffce00', 500: '#d6a300', 600: '#a87d00', 700: '#7d5b00',
          800: '#593f00', 900: '#382700',
        },
        terracotta: { 500: '#d95a14', 600: '#b84407', 700: '#8c3103' },
        ink: '#0f172a',
        paper: '#f8fafc',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        satoshi: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        inter: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        urbanist: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        outfit: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { tightest: '0' },
      maxWidth: { '6xl': '1420px', '7xl': '1420px', prose: '68ch' },
      fontSize: {
        '6xl': ['2.5rem', { lineHeight: '1' }],
        '7xl': ['3rem', { lineHeight: '1' }],
      },
      borderRadius: {
        '3xl': '0.3rem',
      },
    },
  },
  plugins: [typography],
} satisfies Config;
