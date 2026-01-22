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
