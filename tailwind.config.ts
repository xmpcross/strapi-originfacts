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
        // Brand palette (Oct 2026), taken from the logo: blue #0046be, navy
        // #061b46 (footer logo), sun #ffde59. The scales below are built around
        // those three, so a colour class anywhere on the site lands on the logo.
        brand: { blue: '#0046be', navy: '#061b46', sun: '#ffde59' },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          emphasis: '#0046be',
          emphasisHover: '#003ba3',
          emphasisPressed: '#00318a',
          highlight: '#0d52c9',
          highlightHover: '#0046be',
          highlightPressed: '#003ba3',
          hover: '#e8effc',
          pressed: '#c9daf7',
        },
        secondary: {
          DEFAULT: '#fff7d6',
          foreground: 'hsl(var(--secondary-foreground))',
          emphasis: '#f2c418',
          hover: '#ffde59',
          pressed: '#d9ab00',
        },
        success: { emphasis: '#059669' },
        attention: { emphasis: '#d97706' },
        danger: { emphasis: '#dc2626' },
        // Blue scale: 700 is the logo blue, 950 the logo navy.
        forest: {
          50: '#f3f6fd', 100: '#e8effc', 200: '#c9daf7', 300: '#9bb9ef',
          400: '#5f8ee2', 500: '#2a67d3', 600: '#0d52c9', 700: '#0046be',
          800: '#00389a', 900: '#0a2a6b', 950: '#061b46',
        },
        // Sun scale: 300 is the logo sun; 600 and darker are legible as text on white.
        sand: {
          50: '#fffcf0', 100: '#fff7d6', 200: '#ffefa8', 300: '#ffde59',
          400: '#f7cd2a', 500: '#e0b400', 600: '#a88600', 700: '#7a6100',
          800: '#584600', 900: '#382c00',
        },
        // Kept for existing class names; now a deep sun-gold instead of orange.
        terracotta: { 500: '#c99a00', 600: '#9a7600', 700: '#6f5500' },
        ink: '#061b46',
        paper: '#f5f8fd',
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
