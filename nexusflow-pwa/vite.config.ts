import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'raccoon-logo.png'],
      manifest: {
        id: './',
        name: 'BANDIT.OS Workspace',
        short_name: 'BANDIT.OS',
        description: 'Modulares Arbeits-, Projekt- und Fokus-System mit autonomer Sprach-KI',
        theme_color: '#181A1B',
        background_color: '#181A1B',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'BANDIT.OS Frontdisplay',
            short_name: 'Frontdisplay',
            description: 'Kompaktansicht fuer das Galaxy Z Flip 7 Frontdisplay',
            url: './?mode=cover'
          }
        ]
      }
    })
  ]
});
