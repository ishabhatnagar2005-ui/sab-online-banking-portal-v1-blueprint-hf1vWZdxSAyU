const sabRed = {
  50: '#fdf2f3',
  100: '#fce4e6',
  200: '#f8c0c4',
  300: '#f18c94',
  400: '#e84d58',
  500: '#dc313d',
  600: '#d22630',
  700: '#a6192e',
  800: '#871424',
  900: '#6f1422',
  950: '#3d060e',
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
        sab: sabRed,
        gold: sabGold,
        primary: sabRed,
        accent: sabGold,
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f7faf9',
          muted: '#edf3f1',
          inverse: sabRed[950],
        },
        ink: {
          DEFAULT: '#1a1a1a',
          muted: '#4d4d4d',
          subtle: '#595959',
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
        DEFAULT: sabRed[600],
        focus: sabRed[600],
        danger: '#b42318',
      },
      ringWidth: {
        DEFAULT: '2px',
      },
      ringOffsetWidth: {
        DEFAULT: '2px',
      },
      outlineColor: {
        focus: sabRed[600],
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
        focus: `0 0 0 3px ${sabRed[200]}`,
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