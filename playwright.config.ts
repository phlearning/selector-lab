import { defineConfig, devices } from '@playwright/test';

const port = 4321;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}/selector-lab/`,
    trace: 'retain-on-failure',
  },
  // Les Exemples et Solutions de référence (exemples.spec.ts) sont vérifiés dans les trois moteurs :
  // c'est la promesse du site. Les tests d'interface ne tournent que dans Chromium.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: 'exemples.spec.ts' },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: 'exemples.spec.ts' },
  ],
  webServer: {
    // --ignore-lock garde le serveur au premier plan (sinon Astro peut le lancer en arrière-plan).
    command: `npm run preview -- --port ${port} --ignore-lock`,
    url: `http://localhost:${port}/selector-lab/`,
    reuseExistingServer: !process.env.CI,
  },
});
