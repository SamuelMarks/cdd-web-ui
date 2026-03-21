import { test, expect } from '@playwright/test';

test.describe('Theme Toggle Workflow', () => {
  test('should toggle theme between light and dark mode', async ({ page }) => {
    await page.goto('/');

    // Default should be light theme (or whatever it is initialized to, let's just check toggling)
    const html = page.locator('html');

    const themeToggleButton = page.locator('button.theme-toggle');
    await expect(themeToggleButton).toBeVisible();

    const isDarkInitially = await html.evaluate((el) => el.classList.contains('dark-theme'));

    // Toggle theme
    await themeToggleButton.click();

    const isDarkAfterToggle = await html.evaluate((el) => el.classList.contains('dark-theme'));
    expect(isDarkAfterToggle).not.toBe(isDarkInitially);

    // Toggle back
    await themeToggleButton.click();

    const isDarkAfterSecondToggle = await html.evaluate((el) =>
      el.classList.contains('dark-theme'),
    );
    expect(isDarkAfterSecondToggle).toBe(isDarkInitially);
  });
});
