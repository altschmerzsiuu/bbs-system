import type { Config } from 'tailwindcss';

/**
 * BBS Design System — strictly maps to design.md tokens.
 * Never hardcode hex in components. Always use token classes.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      { DEFAULT: 'var(--color-bg)' },
        surface: { DEFAULT: 'var(--color-surface)', secondary: 'var(--color-surface-secondary)' },
        ink:     { DEFAULT: 'var(--color-ink)', secondary: 'var(--color-ink-secondary)', muted: 'var(--color-ink-muted)' },
        gold:    { DEFAULT: 'var(--color-gold)', light: 'var(--color-gold-light)' },
        sage:    { DEFAULT: 'var(--color-sage)' },
        beige:   { DEFAULT: 'var(--color-warm-beige)' },
        /* semantic states mapped for safety during transition */
        status: {
          pending: '#C99A4B',
          confirmed: '#6B8E6B',
          rejected: '#B5705E'
        }
      },
      borderRadius: {
        card: 'var(--radius-card)',
        hero: 'var(--radius-hero)',
        large: 'var(--radius-large)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        nav:  'var(--shadow-nav)',
      },
      maxWidth:   { app: '430px' },
      fontFamily: { 
        display: ['var(--font-display)', 'Times', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif']
      },
      transitionTimingFunction: {
        spring: 'var(--ease-spring)',
        standard: 'var(--ease-standard)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      }
    },
  },
  plugins: [],
} satisfies Config;
