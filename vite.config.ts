import { readFileSync } from 'fs';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Embute o Web App Manifest no HTML como data URL.
 * Evita GET /manifest.json, que recebe 401 em previews com Vercel Deployment Protection
 * (o navegador não envia o mesmo contexto de auth desse recurso).
 */
function inlineWebManifestPlugin(): Plugin {
  return {
    name: 'inline-web-manifest',
    transformIndexHtml(html) {
      const manifestPath = path.resolve(__dirname, 'public/manifest.json');
      const raw = readFileSync(manifestPath, 'utf-8');
      const compact = JSON.stringify(JSON.parse(raw));
      const b64 = Buffer.from(compact, 'utf-8').toString('base64');
      const href = `data:application/manifest+json;base64,${b64}`;
      return html.replace(
        /<link\s+rel="manifest"\s+href="[^"]*"\s*\/>/i,
        `<link rel="manifest" href="${href}" />`
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    publicDir: 'public',
    plugins: [react(), inlineWebManifestPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY_FALLBACK': JSON.stringify(env.GEMINI_API_KEY_FALLBACK || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
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
            'utils-vendor': ['zod', '@supabase/supabase-js'],
          },
        },
      },
      // Configurações para compatibilidade com Capacitor
      emptyOutDir: true,
      sourcemap: false,
    },
    // Base path para compatibilidade com Capacitor
    base: './',
  };
});
