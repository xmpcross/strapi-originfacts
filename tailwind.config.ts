import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';
import animate from 'tailwindcss-animate';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // shadcn/ui semantic tokens (CSS variables in app/globals.css), merged
        // into the existing brand palette. `secondary.DEFAULT` keeps its literal
        // #fff8d6 because the site already uses bg-secondary for callouts.
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
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
          foreground: 'hsl(var(--secondary-foreground))',
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
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [typography, animate],
} satisfies Config;
