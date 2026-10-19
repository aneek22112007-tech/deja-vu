/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { 950: '#07080b', 900: '#0b0d12', 850: '#10131a', 800: '#151923', 700: '#1e2330', 600: '#2a3142', 500: '#3b4459' },
        accent: { DEFAULT: '#a78bfa', soft: '#c4b5fd', deep: '#7c3aed' },
        ok: '#34d399',
        warn: '#fbbf24',
        bad: '#f87171',
      },
      keyframes: {
        pulseRing: { '0%': { transform: 'scale(1)', opacity: '0.6' }, '100%': { transform: 'scale(1.8)', opacity: '0' } },
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scan: { '0%': { top: '-20%' }, '100%': { top: '110%' } },
        shimmer: { '0%': { backgroundPosition: '0% 50%' }, '100%': { backgroundPosition: '200% 50%' } },
      },
      animation: { pulseRing: 'pulseRing 1.4s ease-out infinite', fadeUp: 'fadeUp .35s ease-out both', scan: 'scan 2.4s ease-in-out infinite', shimmer: 'shimmer 6s linear infinite' },
    },
  },
  plugins: [],
};
