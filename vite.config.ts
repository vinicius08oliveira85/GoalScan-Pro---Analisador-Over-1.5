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
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY_FALLBACK': JSON.stringify(env.GEMINI_API_KEY_FALLBACK || ''),
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
