/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f9',
          100: '#d9e2ef',
          200: '#b7cbdf',
          300: '#8baecc',
          400: '#5c8eb6',
          500: '#3c739f',
          600: '#2b5a83',
          700: '#23486a',
          800: '#1b365d',
          900: '#162b49',
          950: '#0e1b30',
        },
        lhu: {
          50: '#f0f6ff',
          100: '#e0edff',
          200: '#b9dbfe',
          300: '#7cbcfd',
          400: '#3899fa',
          500: '#0f75f0',
          600: '#0257cf',
          700: '#0344a6',
          800: '#083a85',
          900: '#0c326d',
          950: '#081f45',
          navy: '#162b49',
          blue: '#1b365d',
          dark: '#0e1b30',
          gold: '#f59e0b',
          amber: '#fbbf24',
          bg: '#f1f5f9',
          card: '#ffffff',
          border: '#e2e8f0',
        },
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
        sans: ['"Inter"', '"Be Vietnam Pro"', '"Segoe UI"', 'Roboto', 'system-ui', '-apple-system', 'sans-serif'],
        pixel: ['"Inter"', '"Be Vietnam Pro"', '"Segoe UI"', 'Roboto', 'system-ui', '-apple-system', 'sans-serif'],
        retro: ['"Inter"', '"Be Vietnam Pro"', '"Segoe UI"', 'Roboto', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'pixel': '4px 4px 0px 0px rgba(0, 0, 0, 0.75)',
        'pixel-sm': '2px 2px 0px 0px rgba(0, 0, 0, 0.75)',
        'pixel-lg': '6px 6px 0px 0px rgba(0, 0, 0, 0.85)',
      }
    },
  },
  plugins: [],
}
