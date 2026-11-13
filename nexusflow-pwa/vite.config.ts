import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'NexusFlow – Pizza Bandit & Workflow System',
        short_name: 'NexusFlow',
        description: 'Modulares Organisations-, Foodtruck- & Smart-Home-System',
        theme_color: '#181A1B',
        background_color: '#181A1B',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        shortcuts: [
          {
            name: 'Flip 7 Cover-Widget',
            short_name: 'Cover-Modus',
            description: 'Direktstart für das Galaxy Z Flip 7 Frontdisplay',
            url: '/?mode=cover'
          }
        ]
      }
    })
  ]
});