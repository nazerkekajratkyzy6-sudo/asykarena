import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

// Обычная сборка (dist/) — для Vercel, с PWA и офлайн-кешем.
// mode "single" — всё в одном HTML-файле для показа без сервера (без PWA: service worker не работает с file://).
// BASE_PATH задаётся для GitHub Pages, например /asiq-arena/
const BASE = process.env.BASE_PATH ?? '/';

export default defineConfig(({ mode }) => ({
  base: BASE,
  plugins: mode === 'single' || mode === 'artifact'
    ? [react(), viteSingleFile()]
    : [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.png', 'apple-touch-icon.png'],
          manifest: {
            name: 'ASIQ ARENA — асық ату тренажёры',
            short_name: 'ASIQ ARENA',
            description: 'Виртуалды ойыннан – шынайы шеберлікке',
            lang: 'kk',
            start_url: BASE,
            scope: BASE,
            display: 'standalone',
            orientation: 'any',
            background_color: '#f7f1e6',
            theme_color: '#f7f1e6',
            icons: [
              { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,png,svg,woff2,wasm}'],
            maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
                handler: 'CacheFirst',
                options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
              },
            ],
          },
        }),
      ],
  build: {
    outDir: mode === 'single' ? 'dist-single' : mode === 'artifact' ? 'dist-artifact' : 'dist',
    chunkSizeWarningLimit: 4000,
  },
}));
