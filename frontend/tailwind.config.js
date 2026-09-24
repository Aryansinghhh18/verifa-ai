/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          darkest: '#07080B',
          dark: '#0A0D14',
          card: '#121620',
          elevated: '#1A1F2C',
          border: '#242B3D',
          hover: '#1E2536'
        },
        brand: {
          yellow: '#FACC15',
          gold: '#EAB308',
          cyan: '#06B6D4',
          sky: '#38BDF8',
          rose: '#F43F5E',
          emerald: '#10B981',
          amber: '#F59E0B'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'glow-yellow': '0 0 20px -5px rgba(250, 204, 21, 0.3)',
        'glow-cyan': '0 0 20px -5px rgba(6, 182, 212, 0.3)',
      }
    },
  },
  plugins: [],
}
