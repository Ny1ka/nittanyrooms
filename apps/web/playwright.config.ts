import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build (`vite preview`).
 * /api/availability is mocked per test and map tiles are blocked, so runs are
 * deterministic and never contact Penn State or OpenFreeMap.
 *
 * Local runs can point at an already-downloaded Chromium with
 * PW_CHROMIUM_PATH=/path/to/chrome. CI uses `playwright install chromium`.
 */
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    timezoneId: 'America/New_York',
    locale: 'en-US',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], browserName: 'chromium' }, grep: /@mobile/ },
  ],
  webServer: {
    command: `pnpm exec vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
