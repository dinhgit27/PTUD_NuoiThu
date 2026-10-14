/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f4f7f5',
          100: '#e3ebe6',
          200: '#c8d9ce',
          300: '#a5c0b0',
          400: '#8DA399', // Primary Sage Green
          500: '#728980',
          600: '#5a6e66',
          700: '#485752',
          800: '#3a4642',
          900: '#313a37',
        },
        terracotta: {
          50: '#fbf5f2',
          100: '#f6eae4',
          200: '#edd6ca',
          300: '#e1baa9',
          400: '#D98A6C', // Accent Terracotta
          500: '#cb6e4c',
          600: '#bc5636',
          700: '#9d4329',
          800: '#813926',
          900: '#6d3224',
        },
        cream: {
          50: '#ffffff',
          100: '#F9F9F6', // Natural Cream Background
          200: '#f3f3ed',
          300: '#e7e7dc',
        },
        charcoal: '#333333',
        pixelDark: '#1E1E1E',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', '"Courier New"', 'monospace'],
        retro: ['"VT323"', 'monospace'],
      },
      boxShadow: {
        'pixel': '4px 4px 0px 0px rgba(0, 0, 0, 0.75)',
        'pixel-sm': '2px 2px 0px 0px rgba(0, 0, 0, 0.75)',
        'pixel-lg': '6px 6px 0px 0px rgba(0, 0, 0, 0.85)',
      }
    },
  },
  plugins: [],
}
