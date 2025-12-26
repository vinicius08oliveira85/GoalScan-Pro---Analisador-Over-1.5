import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const geminiApiKey =
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      env.VITE_GEMINI_API_KEY ||
      env.GEMINI_API_KEY ||
      env.API_KEY;
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      publicDir: 'public',
      plugins: [react()],
      define: {
        // Compat: o app lê `process.env.*` (injetado em build) e/ou `import.meta.env.VITE_*`.
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
          external: ['@capacitor/core'],
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'ui-vendor': ['lucide-react', 'recharts'],
              'utils-vendor': ['zod', '@supabase/supabase-js']
            }
          }
        },
        // Configurações para compatibilidade com Capacitor
        emptyOutDir: true,
        sourcemap: false
      },
      // Base path para compatibilidade com Capacitor
      base: './'
    };
});
