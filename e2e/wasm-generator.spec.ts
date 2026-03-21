import { test, expect } from '@playwright/test';

test.describe('WASM Code Generator', () => {
  test('should fallback correctly if WASM binaries are missing', async ({ page }) => {
    // Intercept WASM requests to ensure they fail gracefully
    await page.route('**/assets/wasm/*.wasm', (route) => route.abort('failed'));

    await page.goto('/');

    await page.waitForTimeout(500);

    // Run Generation (TypeScript is selected by default)
    await page.getByRole('button', { name: 'Run Code Generation' }).click();

    // Verify fallback code appears somewhere in the page
    await expect(page.locator('text=Fallback mock activated').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('text=SwaggerPetstoreClient').first()).toBeVisible({ timeout: 5000 });
  });
});
