import { defineConfig, devices } from '@playwright/test';

/** Base URL for Playwright E2E test execution. */
const E2E_URL = process.env['CI'] ? 'http://localhost:4200' : 'http://localhost:8083';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 2,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--js-flags=--stack-size=100000'] },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], launchOptions: { args: ['--js-flags=--stack-size=100000'] } },
    },
  ],
  webServer: {
    command: process.env['CI'] ? 'npx --yes serve -s dist/cdd-web-ui/browser -p 4200' : 'npm start',
    url: E2E_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 300000,
  },
  timeout: 180000,
});
