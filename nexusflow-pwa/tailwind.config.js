/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      colors: {
        canvas: '#111317',
        surface: '#191C22',
        anthracite: {
          main: '#111317',
          card: '#191C22',
          sub: '#22262F'
        },
        petrol: {
          primary: '#0D9488',
          highlight: '#14B8A6'
        },
        honey: '#E5A93C'
      }
    }
  },
  plugins: []
};