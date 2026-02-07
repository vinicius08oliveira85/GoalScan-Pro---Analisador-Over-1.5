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
          // Base surfaces: A bit lighter and less saturated for reduced eye strain
          'base-100': 'oklch(25% 0.02 230)',
          'base-200': 'oklch(30% 0.025 230)',
          'base-300': 'oklch(35% 0.03 230)',
          'base-content': 'oklch(90% 0.02 230)', // Softer text color

          // Brand: Adjusted for better harmony
          primary: 'oklch(50% 0.15 260)', // A solid, pleasing purple
          'primary-content': 'oklch(98% 0.01 260)',
          secondary: 'oklch(65% 0.15 190)', // A calming teal instead of magenta
          'secondary-content': 'oklch(98% 0.01 190)',
          accent: 'oklch(70% 0.15 80)', // A soft, warm gold for accents
          'accent-content': 'oklch(98% 0.01 80)',

          // Neutral: Aligned with the new base colors
          neutral: 'oklch(30% 0.02 230)',
          'neutral-content': 'oklch(90% 0.02 230)',

          // Semantic: Toned down for less glare
          info: 'oklch(70% 0.15 240)',
          'info-content': 'oklch(98% 0.01 240)',
          success: 'oklch(65% 0.18 160)',
          'success-content': 'oklch(98% 0.01 160)',
          warning: 'oklch(75% 0.2 90)',
          'warning-content': 'oklch(98% 0.01 90)',
          error: 'oklch(65% 0.25 25)',
          'error-content': 'oklch(98% 0.01 25)',

          // Shape & borders
          '--rounded-box': '1rem', // Slightly reduced rounding for a cleaner look
          '--rounded-btn': '0.5rem',
          '--rounded-badge': '1.9rem',
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
