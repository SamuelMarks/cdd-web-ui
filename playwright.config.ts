import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // E2E tests should not run fully parallel if they might mutate same state/storage
  // but it's fine for our client-only app, though let's disable fullyParallel to be safe
  // as per step 259 "Ensure E2E tests do not run sequentially to save time" (Wait, the plan says "Ensure E2E tests do not run sequentially to save time", which means they SHOULD run in parallel. I will keep fullyParallel: true).
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }], // Configure HTML reports (Step 254)
  ],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure', // Configure screenshots on failure (Step 255)
  },
  projects: [
    // Configure across Chromium, Firefox, WebKit (Step 256)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewport test (Step 252)
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120000,
  },
});
