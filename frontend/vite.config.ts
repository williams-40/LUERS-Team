/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import mkcert from 'vite-plugin-mkcert';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5175,
    // Bind all interfaces, not just localhost, so devices on the same
    // network (phones, other laptops) can load the dev server too.
    host: true,
    // getUserMedia (photo/video/voice evidence) and geolocation only work
    // in a secure context — plain http:// on a LAN IP doesn't qualify, only
    // localhost does. vite-plugin-mkcert below gives this dev server a
    // locally-trusted cert covering localhost + this machine's LAN IPs.
    proxy: {
      // Proxied server-side so the browser only ever talks to this one
      // HTTPS origin — the backend itself stays plain http, and reviewers
      // never see a second certificate warning for a separate :8000 origin.
      //
      // Deliberately no changeOrigin here: Django's request.build_absolute_uri()
      // (used for evidence file_url, etc.) echoes back whatever Host header
      // it receives. Leaving the client's real Host header (this dev
      // server's own host:port) untouched means those generated URLs point
      // back at this same proxy — which is why /media is proxied too — so
      // they resolve correctly for every reviewer regardless of which
      // host/IP they used to reach the app.
      // X-Forwarded-Proto: this dev server always terminates TLS itself
      // (mkcert), so it's always https from the client's point of view even
      // though the backend it forwards to is plain http. Paired with
      // SECURE_PROXY_SSL_HEADER in development.py, this makes Django's
      // request.is_secure() (and so build_absolute_uri()) say https too, so
      // generated URLs like evidence file_url don't trigger mixed-content
      // issues on the media requests they point back at.
      '/api': { target: 'http://localhost:8000', headers: { 'X-Forwarded-Proto': 'https' } },
      '/ws': { target: 'http://localhost:8000', ws: true, headers: { 'X-Forwarded-Proto': 'https' } },
      '/media': { target: 'http://localhost:8000', headers: { 'X-Forwarded-Proto': 'https' } },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
  plugins: [
    mkcert(),
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
            purpose: 'any',
          },
          {
            // Upscaled from the 192x192 source mark — the only art that
            // exists; a real 512x512 design asset can swap this in later.
            src: '/brand/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // Solid brand-ink background + the mark scaled to fit inside
            // the maskable safe zone, so OS icon masks (circle, squircle,
            // etc.) never crop into the logo.
            src: '/brand/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
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
