import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const APP_ICON_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="112" fill="#181A1B"/>
    <rect x="28" y="28" width="456" height="456" rx="92" fill="#24292E" stroke="#14B8A6" stroke-width="16"/>
    <circle cx="256" cy="220" r="88" fill="#0A9396"/>
    <rect x="220" y="160" width="72" height="110" rx="36" fill="#F8F9FA"/>
    <path d="M176 225 C176 275, 336 275, 336 225" stroke="#F8F9FA" stroke-width="20" fill="none" stroke-linecap="round"/>
    <line x1="256" y1="308" x2="256" y2="365" stroke="#14B8A6" stroke-width="22" stroke-linecap="round"/>
    <line x1="196" y1="365" x2="316" y2="365" stroke="#14B8A6" stroke-width="22" stroke-linecap="round"/>
  </svg>`);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: '/',
        name: 'NexusFlow – Pizza Bandit & Workflow',
        short_name: 'NexusFlow',
        description: 'Mobile Sprach- & Projektzentrale für Pizza Bandit, Baustelle & Privat',
        theme_color: '#181A1B',
        background_color: '#181A1B',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: APP_ICON_SVG,
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Flip 7 Frontdisplay',
            short_name: 'Frontdisplay',
            description: 'Kompakt-Kachel für das Galaxy Z Flip 7 Frontdisplay',
            url: '/?mode=cover'
          }
        ]
      }
    })
  ]
});
