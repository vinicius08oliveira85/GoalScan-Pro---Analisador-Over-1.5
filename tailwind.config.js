/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        nord: {
          // Base surfaces (Tema claro Nord)
          'base-100': 'oklch(95.127% 0.007 260.731)',
          'base-200': 'oklch(93.299% 0.01 261.788)',
          'base-300': 'oklch(89.925% 0.016 262.749)',
          'base-content': 'oklch(32.437% 0.022 264.182)',

          // Brand
          primary: 'oklch(59.435% 0.077 254.027)',
          'primary-content': 'oklch(11.887% 0.015 254.027)',
          secondary: 'oklch(69.651% 0.059 248.687)',
          'secondary-content': 'oklch(13.93% 0.011 248.687)',
          accent: 'oklch(77.464% 0.062 217.469)',
          'accent-content': 'oklch(15.492% 0.012 217.469)',

          // Neutral
          neutral: 'oklch(45.229% 0.035 264.131)',
          'neutral-content': 'oklch(89.925% 0.016 262.749)',

          // Semantic
          info: 'oklch(69.207% 0.062 332.664)',
          'info-content': 'oklch(13.841% 0.012 332.664)',
          success: 'oklch(76.827% 0.074 131.063)',
          'success-content': 'oklch(15.365% 0.014 131.063)',
          warning: 'oklch(85.486% 0.089 84.093)',
          'warning-content': 'oklch(17.097% 0.017 84.093)',
          error: 'oklch(60.61% 0.12 15.341)',
          'error-content': 'oklch(12.122% 0.024 15.341)',

          // Shape & borders
          '--rounded-box': '0.5rem',
          '--rounded-btn': '0.25rem',
          '--rounded-badge': '0.25rem',
          '--border-btn': '1px',
          '--tab-border': '1px',
        },
      },
      {
        goalscan_glass: {
          // Base surfaces (Glass Modern controlado)
          'base-100': 'oklch(18% 0.03 229.695)',
          'base-200': 'oklch(22% 0.035 227.392)',
          'base-300': 'oklch(28% 0.04 224.283)',
          'base-content': 'oklch(95% 0.045 203.388)',

          // Brand
          primary: 'oklch(44% 0.043 257.281)',
          'primary-content': 'oklch(98% 0.003 247.858)',
          secondary: 'oklch(55% 0.288 302.321)',
          'secondary-content': 'oklch(97% 0.014 308.299)',
          accent: 'oklch(55% 0.288 302.321)',
          'accent-content': 'oklch(97% 0.014 308.299)',

          // Neutral
          neutral: 'oklch(24% 0.03 229.695)',
          'neutral-content': 'oklch(98% 0.019 200.873)',

          // Semantic
          info: 'oklch(68% 0.169 237.323)',
          'info-content': 'oklch(97% 0.013 236.62)',
          success: 'oklch(70% 0.14 182.503)',
          'success-content': 'oklch(98% 0.014 180.72)',
          warning: 'oklch(70% 0.213 47.604)',
          'warning-content': 'oklch(98% 0.016 73.684)',
          error: 'oklch(64% 0.246 16.439)',
          'error-content': 'oklch(96% 0.015 12.422)',

          // Shape & borders
          '--rounded-box': '2rem',
          '--rounded-btn': '2rem',
          '--rounded-badge': '2rem',
          '--border-btn': '1px',
          '--tab-border': '1px',
        },
      },
      'dark',
    ],
    darkTheme: 'goalscan_glass',
    base: true,
    styled: true,
    utils: true,
    prefix: '',
    logs: true,
    themeRoot: ':root',
  },
};
