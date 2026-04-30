import type { Config } from 'tailwindcss';

export default {
  content: [
    './components/**/*.{vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary:    'rgb(var(--color-primary) / <alpha-value>)',
          secondary:  'rgb(var(--color-secondary) / <alpha-value>)',
          accent:     'rgb(var(--color-accent) / <alpha-value>)',
          background: 'rgb(var(--color-background) / <alpha-value>)',
        },
        shell: {
          bg:      'rgb(var(--shell-bg) / <alpha-value>)',
          sidebar: 'rgb(var(--shell-sidebar) / <alpha-value>)',
          pink:    'rgb(var(--shell-pink) / <alpha-value>)',
        },
        cream: {
          DEFAULT: '#f5ede4',
          dark:    '#edddd0',
        },
        maroon: {
          DEFAULT: '#3d1820',
          light:   '#5c2530',
          dark:    '#2a0f16',
        },
        rose: {
          warm: '#e8748a',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui'],
        serif:   ['DM Serif Display', 'Georgia', 'ui-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace'],
      },
      borderRadius: {
        xl:   '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-up':  'slideUp 0.25s ease-out',
        'slide-in':  'slideIn 0.2s ease-out',
        'spin-slow': 'spin 2s linear infinite',
        'pop':       'pop 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                                      to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' },        to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-8px)' },       to: { opacity: '1', transform: 'translateX(0)' } },
        pop:     { from: { opacity: '0', transform: 'scale(0.94)' },            to: { opacity: '1', transform: 'scale(1)' } },
      },
      boxShadow: {
        'warm-sm': '0 1px 4px rgba(61,24,32,0.08)',
        'warm':    '0 2px 12px rgba(61,24,32,0.09), 0 1px 3px rgba(61,24,32,0.05)',
        'warm-lg': '0 8px 32px rgba(61,24,32,0.12), 0 2px 8px rgba(61,24,32,0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;
