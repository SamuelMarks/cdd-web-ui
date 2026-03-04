import { test, expect } from '@playwright/test';

test.describe('Online Settings Workflow', () => {
  // Clear localStorage before starting so tests run isolated
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
  });

  test('should open settings dialog, connect, and login', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: 'Open Online Settings' }).click();
    await expect(page.locator('h2')).toContainText('Online Mode Settings');

    // Fill URL and connect
    await page.locator('input[formControlName="url"]').fill('http://localhost:8080');
    await page.getByRole('button', { name: 'Connect to backend' }).click();

    // Verify connected
    await expect(page.locator('p').filter({ hasText: 'Currently Online' })).toBeVisible();

    // Authenticate (login)
    // In e2e, since we don't have a real backend running for this test unless we spin it up,
    // we'll mock the API call. Playwright can intercept and mock requests.
    await page.route('**/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'mock-token' }),
      });
    });

    await page.locator('input[formControlName="username"]').fill('testuser');
    await page.locator('input[formControlName="password"]').fill('testpass');
    await page.getByRole('button', { name: 'Login', exact: true }).click();

    // Check success message
    await expect(page.locator('.success')).toContainText('Logged in successfully!');

    // Close dialog
    await page.getByRole('button', { name: 'Close dialog' }).click();

    // Verify header reflects online status
    await expect(page.locator('h1')).toContainText('CDD Web UI (Online)');
  });
});
