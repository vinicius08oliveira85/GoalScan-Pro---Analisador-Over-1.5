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
        light: {
          "primary": "#6366f1",
          "secondary": "#a78bfa",
          "accent": "#ec4899",
          "neutral": "#e5e7eb",
          "base-100": "#ffffff",
          "base-200": "#f9fafb",
          "base-300": "#f3f4f6",
          "info": "#3abff8",
          "success": "#36d399",
          "warning": "#fbbd23",
          "error": "#f87272",
          // custom
          '--btn-text-case': 'none',
        },
        dark: {
          "primary": "#6366f1",
          "secondary": "#a78bfa",
          "accent": "#ec4899",
          "neutral": "#1e293b",
          "base-100": "#0f172a",
          "info": "#3abff8",
          "success": "#36d399",
          "warning": "#fbbd23",
          "error": "#f87272",
          // custom
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
};
