/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0E0E10',
        surface: {
          DEFAULT: '#18181B',
          hover: '#222226',
        },
        border: {
          subtle: '#27272A',
          focus: '#FACC15',
        },
        accent: {
          yellow: '#FACC15',
          'yellow-hover': '#EAB308',
        },
        finance: {
          pos: '#22C55E',
          neg: '#EF4444',
          neutral: '#A1A1AA',
          invest: '#38BDF8',
          career: '#818CF8',
        },
        assetClass: {
          rendaFixa: '#10B981',
          acoes: '#6366F1',
          fiis: '#A855F7',
          internacional: '#3B82F6',
          cripto: '#F59E0B',
          reserva: '#14B8A6',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
