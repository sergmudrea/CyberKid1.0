// vite.config.ts
// ПРОМЕТЕЙ: Конфигурация Vite с плагином для автоматической генерации манифеста уровней.
// Добавлен вызов скрипта generate-level-manifest.js перед каждой сборкой (build).
// Также настроены алиасы, PWA, оптимизация для Capacitor.

import { defineConfig } from 'vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

// Плагин для генерации манифеста уровней перед сборкой
function levelManifestPlugin() {
  return {
    name: 'level-manifest-generator',
    buildStart() {
      console.log('🔧 Generating level manifest...');
      try {
        execSync('node scripts/generate-level-manifest.js', { stdio: 'inherit' });
        console.log('✅ Level manifest generated successfully');
      } catch (error) {
        console.error('❌ Failed to generate level manifest:', error);
      }
    },
  };
}

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    https: false,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  plugins: [
    levelManifestPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,mp3}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
});
