const sabGreen = {
  50: '#edf8f5',
  100: '#d4eee7',
  200: '#a9ddd0',
  300: '#73c5b2',
  400: '#3ba58e',
  500: '#12836c',
  600: '#006b57',
  700: '#005445',
  800: '#064438',
  900: '#07382f',
  950: '#03201b',
};

const sabGold = {
  50: '#fdf9ed',
  100: '#f8edce',
  200: '#f1da9a',
  300: '#e9c363',
  400: '#dfa93c',
  500: '#d1952b',
  600: '#b47321',
  700: '#91541e',
  800: '#784320',
  900: '#66391f',
  950: '#3b1d0d',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sab: sabGreen,
        gold: sabGold,
        primary: sabGreen,
        accent: sabGold,
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f7faf9',
          muted: '#edf3f1',
          inverse: sabGreen[950],
        },
        ink: {
          DEFAULT: '#152521',
          muted: '#52645f',
          subtle: '#71817d',
          inverse: '#ffffff',
        },
        border: {
          DEFAULT: '#d5dfdc',
          strong: '#a8b8b3',
        },
        success: '#16794f',
        warning: '#b86b00',
        danger: '#b42318',
        info: '#1769aa',
      },
      fontFamily: {
        sans: [
          'SAB Sans',
          'Noto Sans Arabic',
          'Segoe UI',
          'Arial',
          'sans-serif',
        ],
        latin: ['SAB Sans', 'Segoe UI', 'Arial', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'Tahoma', 'Arial', 'sans-serif'],
      },
      ringColor: {
        DEFAULT: sabGreen[600],
        focus: sabGreen[600],
        danger: '#b42318',
      },
      ringWidth: {
        DEFAULT: '2px',
      },
      ringOffsetWidth: {
        DEFAULT: '2px',
      },
      outlineColor: {
        focus: sabGreen[600],
      },
      screens: {
        xs: '30rem',
        '3xl': '120rem',
      },
      maxWidth: {
        content: '80rem',
        prose: '72ch',
      },
      minHeight: {
        touch: '2.75rem',
      },
      minWidth: {
        touch: '2.75rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(3 32 27 / 0.08), 0 1px 2px -1px rgb(3 32 27 / 0.08)',
        elevated:
          '0 12px 24px -8px rgb(3 32 27 / 0.18), 0 4px 8px -4px rgb(3 32 27 / 0.08)',
        focus: `0 0 0 3px ${sabGreen[200]}`,
      },
    },
  },
  plugins: [
    ({ addUtilities }) => {
      addUtilities({
        '.dir-ltr': {
          direction: 'ltr',
        },
        '.dir-rtl': {
          direction: 'rtl',
        },
        '.bidi-isolate': {
          unicodeBidi: 'isolate',
        },
        '.bidi-plaintext': {
          unicodeBidi: 'plaintext',
        },
      });
    },
  ],
};