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
          // Base surfaces (black monochrome)
          'base-100': 'oklch(0% 0 0)',
          'base-200': 'oklch(19% 0 0)',
          'base-300': 'oklch(22% 0 0)',
          'base-content': 'oklch(87.609% 0 0)',

          // Brand (monochrome)
          primary: 'oklch(35% 0 0)',
          'primary-content': 'oklch(100% 0 0)',
          secondary: 'oklch(35% 0 0)',
          'secondary-content': 'oklch(100% 0 0)',
          accent: 'oklch(35% 0 0)',
          'accent-content': 'oklch(100% 0 0)',

          // Neutral
          neutral: 'oklch(35% 0 0)',
          'neutral-content': 'oklch(100% 0 0)',

          // Semantic
          info: 'oklch(60% 0 0)',
          'info-content': 'oklch(100% 0 0)',
          success: 'oklch(51.975% 0.176 142.495)',
          'success-content': 'oklch(90.395% 0.035 142.495)',
          warning: 'oklch(96.798% 0.211 109.769)',
          'warning-content': 'oklch(19.359% 0.042 109.769)',
          error: 'oklch(62.795% 0.257 29.233)',
          'error-content': 'oklch(12.559% 0.051 29.233)',

          // Shape & borders (compacto)
          '--rounded-box': '0.5rem',
          '--rounded-btn': '0.5rem',
          '--rounded-badge': '0.5rem',
          '--border-btn': '1px',
          '--tab-border': '1px',
        },
      },
      {
        goalscan_light: {
          // Base surfaces (Light glass morphism)
          'base-100': 'oklch(97% 0.008 247)',
          'base-200': 'oklch(94% 0.01 247)',
          'base-300': 'oklch(90% 0.012 247)',
          'base-content': 'oklch(20% 0.03 240)',

          // Brand (slightly lighter primary for contrast on white)
          primary: 'oklch(45% 0.12 264)',
          'primary-content': 'oklch(98% 0.003 264)',
          secondary: 'oklch(50% 0.22 302)',
          'secondary-content': 'oklch(97% 0.014 302)',
          accent: 'oklch(50% 0.22 302)',
          'accent-content': 'oklch(97% 0.014 302)',

          // Neutral
          neutral: 'oklch(92% 0.008 247)',
          'neutral-content': 'oklch(25% 0.03 247)',

          // Semantic
          info: 'oklch(55% 0.18 237)',
          'info-content': 'oklch(97% 0.013 237)',
          success: 'oklch(55% 0.17 162)',
          'success-content': 'oklch(98% 0.014 162)',
          warning: 'oklch(62% 0.19 65)',
          'warning-content': 'oklch(25% 0.06 65)',
          error: 'oklch(55% 0.22 25)',
          'error-content': 'oklch(96% 0.015 25)',

          // Shape & borders
          '--rounded-box': '2rem',
          '--rounded-btn': '2rem',
          '--rounded-badge': '2rem',
          '--border-btn': '1px',
          '--tab-border': '1px',
        },
      },
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
