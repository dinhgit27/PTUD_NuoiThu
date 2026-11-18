/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Collar Blue & Window Sky (from the Cat's blue collar & office window)
        navy: {
          50: '#f2f7fc',
          100: '#e1eef8',
          200: '#bfe0f9',
          300: '#8fc2eb',
          400: '#5a9bd5',
          500: '#3874b8',
          600: '#2b5b96',
          700: '#244978',
          800: '#1f3c63',
          900: '#1b3252',
          950: '#122036',
        },
        lhu: {
          50: '#f2f7fc',
          100: '#e1eef8',
          200: '#bfe0f9',
          300: '#8fc2eb',
          400: '#5a9bd5',
          500: '#3874b8',
          600: '#2b5b96',
          700: '#244978',
          800: '#1f3c63',
          900: '#1b3252',
          950: '#122036',
          navy: '#23293a',
          blue: '#2b5b96',
          dark: '#181d2a',
          gold: '#f59e0b',
          amber: '#fbbf24',
          bg: '#f6eee3',
          card: '#fffcf7',
          border: '#e5d5c3',
        },
        // Desk Plant Sage Green (from the potted plant on the cat's desk)
        sage: {
          50: '#f3f8f4',
          100: '#e2efe5',
          200: '#c5e0cc',
          300: '#9ac8a7',
          400: '#6ead81',
          500: '#529166',
          600: '#407551',
          700: '#355e43',
          800: '#2c4c37',
          900: '#253f2e',
        },
        // Tabby Cat Fur & Warm Wood Desk (Caramel / Latte Brown)
        terracotta: {
          50: '#fcf7f2',
          100: '#f7ece0',
          200: '#eed6be',
          300: '#e1b892',
          400: '#cf9666',
          500: '#bc7c48',
          600: '#a36436',
          700: '#874f2c',
          800: '#6f4228',
          900: '#5b3723',
        },
        // Creamy White Cat Fur Background
        cream: {
          50: '#ffffff',
          100: '#f6eee3',
          200: '#efe3d2',
          300: '#e2cfb6',
        },
        charcoal: '#23293a',
        pixelDark: '#1a1e29',
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
        'pixel': '4px 4px 0px 0px rgba(35, 41, 58, 0.85)',
        'pixel-sm': '2px 2px 0px 0px rgba(35, 41, 58, 0.85)',
        'pixel-lg': '6px 6px 0px 0px rgba(35, 41, 58, 0.9)',
      }
    },
  },
  plugins: [],
}
