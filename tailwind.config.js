/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './components/layout/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      /* Breakpoints explícitos (mobile-first); defaults Tailwind já cobrem sm–2xl */
      screens: {
        xs: '380px',
      },
      maxWidth: {
        readable: '65ch',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        /* Paleta alinhada a src/index.css (oklch ≈ estes hex) — contraste AA corpo em base-100 */
        light: {
          primary: '#4F46E5',
          'primary-content': '#F8FAFC',
          secondary: '#6366F1',
          'secondary-content': '#F8FAFC',
          accent: '#DB2777',
          'accent-content': '#FDF2F8',
          neutral: '#1E293B',
          'neutral-content': '#F1F5F9',
          'base-100': '#FFFFFF',
          'base-200': '#F1F5F9',
          'base-300': '#E2E8F0',
          'base-content': '#172554',
          info: '#2563EB',
          'info-content': '#F8FAFC',
          success: '#047857',
          'success-content': '#ECFDF5',
          warning: '#B45309',
          'warning-content': '#FFFBEB',
          error: '#B91C1C',
          'error-content': '#FEF2F2',
          '--btn-text-case': 'none',
        },
        dark: {
          primary: '#818CF8',
          'primary-content': '#1E1B4B',
          secondary: '#A78BFA',
          'secondary-content': '#1E1B4B',
          accent: '#F472B6',
          'accent-content': '#1E1B4B',
          neutral: '#CBD5E1',
          'neutral-content': '#0F172A',
          'base-100': '#0F172A',
          'base-200': '#1E293B',
          'base-300': '#334155',
          'base-content': '#F1F5F9',
          info: '#38BDF8',
          'info-content': '#0C4A6E',
          success: '#34D399',
          'success-content': '#064E3B',
          warning: '#FBBF24',
          'warning-content': '#422006',
          error: '#F87171',
          'error-content': '#450A0A',
          '--btn-text-case': 'none',
        },
        goalscan_glass: {
          primary: '#6366f1' /* Indigo 500 */,
          secondary: '#a78bfa' /* Violet 400 */,
          accent: '#ec4899' /* Pink 500 */,
          neutral: '#1a1b26' /* Cor de base escura para texto e elementos neutros */,
          'base-100':
            'rgba(10, 10, 10, 0.3)' /* Fundo semi-transparente escuro */,
          'base-200':
            'rgba(30, 30, 30, 0.4)' /* Fundo de card semi-transparente */,
          'base-300':
            'rgba(50, 50, 50, 0.5)' /* Fundo de card hover/ativo */,
          info: '#3abff8' /* Azul claro para informações */,
          success: '#36d399' /* Verde para sucesso */,
          warning: '#fbbd23' /* Amarelo para avisos */,
          error: '#f87272' /* Vermelho para erros */,

          /* Ajustes para Contraste e Efeito Glass */
          '--rounded-box': '1rem' /* Bordas mais arredondadas */,
          '--rounded-btn': '0.5rem' /* Bordas de botão arredondadas */,
          '--glass-opacity': '10%' /* Opacidade do efeito glass */,
          '--glass-blur': '10px' /* Desfoque do efeito glass */,
          '--glass-border-opacity': '10%' /* Opacidade da borda do glass */,
          '--glass-text-opacity': '80%' /* Opacidade do texto em fundos glass */,

          /* Cores de Texto */
          '--tw-prose-body': '#d1d5db' /* Cinza claro para texto do corpo */,
          '--tw-prose-headings': '#ffffff' /* Branco para cabeçalhos */,
          '--tw-prose-lead': '#d1d5db' /* Cinza claro para lead text */,
          '--tw-prose-links': '#a78bfa' /* Violeta para links */,
          '--tw-prose-bold': '#ffffff' /* Branco para texto em negrito */,
          '--tw-prose-counters': '#d1d5db' /* Cinza claro para contadores */,
          '--tw-prose-bullets': '#a78bfa' /* Violeta para marcadores */,
          '--btn-text-case': 'none',
        },
      },
    ],
    base: true,
    styled: true,
    utils: true,
    prefix: '',
    logs: true,
    themeRoot: ':root',
  },
}
