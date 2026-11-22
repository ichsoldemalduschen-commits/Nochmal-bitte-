import { defineConfig } from '@playwright/test';

/**
 * Playwright Konfiguration für den Mobile-Guard auf 390×844 px (iPhone 14 Standard).
 * Testet gegen den echten gebauten Produktions-Stand (dist/) mit dem exakten Vite base-Pfad.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/Nochmal-bitte-/',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Mobile-Guard-390x844',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/Nochmal-bitte-/',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
