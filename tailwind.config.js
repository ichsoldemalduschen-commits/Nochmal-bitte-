/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        anthracite: {
          main: '#181A1B',
          card: '#24292E',
          sub: '#2F363D'
        },
        petrol: {
          primary: '#0A9396',
          highlight: '#14B8A6'
        }
      }
    }
  },
  plugins: []
};