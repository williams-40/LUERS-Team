/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5175,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'LUERS — Lira University Emergency Reporting System',
        short_name: 'LUERS',
        description: 'Report and track campus emergencies in real time.',
        theme_color: '#0a1f44',
        background_color: '#0a1f44',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/brand/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // Keep the shell offline; report creation goes through the app's
        // own IndexedDB outbox (lib/offline-queue.ts + lib/offline-sync.ts,
        // replayed via the normal authenticated API client) rather than a
        // generic runtime cache or Workbox's BackgroundSyncPlugin — see
        // that module for why.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
});
