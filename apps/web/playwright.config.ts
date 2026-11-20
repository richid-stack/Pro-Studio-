import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL lets CI or a developer point the tests at an already running build.
const external = process.env.E2E_BASE_URL;
// The app can be built under a sub-path (GitHub Pages). VITE_BASE must match the build used here.
const base = process.env.VITE_BASE ?? '/';
const local = `http://localhost:4173${base}`;
// Locally only Chromium is assumed to be installed. CI sets E2E_ALL_BROWSERS=1 to add the rest.
const all = process.env.E2E_ALL_BROWSERS === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: external ?? local, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(all
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
          { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
          { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
        ]
      : []),
  ],
  webServer: external
    ? undefined
    : {
        command: 'pnpm build && pnpm preview --port 4173 --strictPort',
        url: local,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
