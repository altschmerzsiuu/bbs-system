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
        bg:      { DEFAULT: 'var(--bg)' },
        surface: { DEFAULT: 'var(--surface)', dark: 'var(--surface-dark)', muted: '#F3F4F6' },
        ink:     { DEFAULT: 'var(--ink)', muted: 'var(--ink-2)', faint: 'var(--ink-3)', 'on-dark': 'var(--ink-on-dark)' },
        gold:    { DEFAULT: 'var(--gold)', deep: 'var(--gold-deep)', accent: 'var(--gold-accent)', tint: 'var(--gold-tint)' },
        emerald: { DEFAULT: 'var(--emerald)', soft: 'var(--emerald-soft)' },
        clay:    { DEFAULT: 'var(--clay)', soft: 'var(--clay-soft)' },
        lilac:   { DEFAULT: 'var(--lilac)', soft: 'var(--lilac-soft)' },
        /* backward compat */
        sage:    { DEFAULT: 'var(--teal)', soft: 'var(--teal-soft)' },
        teal:    { DEFAULT: 'var(--teal)', soft: 'var(--teal-soft)' },
        stable:  { DEFAULT: 'var(--stable)', mid: 'var(--stable-mid)' },
        line:    { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
        /* aliases */
        'gold-soft':   'var(--gold-accent)',
        'gold-deep':   'var(--gold-deep)',
        'ink-muted':   'var(--ink-2)',
        'ink-faint':   'var(--ink-3)',
        'surface-2':   '#F3F4F6',
        'clay-soft':   'var(--clay-soft)',
        'lilac-soft':  'var(--lilac-soft)',
        'teal-soft':   'var(--teal-soft)',
        'sage-soft':   'var(--teal-soft)',
        'stable-mid':  'var(--stable-mid)',
        'line-strong': 'var(--border-strong)',
      },
      borderRadius: {
        sm:   '6px',
        card: '16px',
        hero: '24px',
        xl2:  '20px',
        pill: '9999px',
      },
      boxShadow: {
        sm:   'var(--shadow-sm)',
        card: 'var(--shadow-card)',
        nav:  'var(--shadow-nav)',
        gold: 'var(--shadow-gold)',
      },
      maxWidth:   { app: '430px' },
      fontFamily: { sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'] },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
