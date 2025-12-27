import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      publicDir: 'public',
      plugins: [react()],
      // IMPORTANTE (segurança):
      // Não injetar a chave do Gemini no bundle. Em produção, use /api/gemini (server-side).
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
