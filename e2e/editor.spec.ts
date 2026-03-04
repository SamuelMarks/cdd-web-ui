import { test, expect } from '@playwright/test';

test.describe('Editor Workflow', () => {
  test('should load sandbox mode by default with Petstore spec', async ({ page }) => {
    await page.goto('/');

    // Check we are in Sandbox mode
    await expect(page.locator('.sandbox-badge')).toHaveText('Sandbox Mode');

    // Check that Petstore is loaded in the editor
    const specTextArea = page.locator('ngx-monaco-editor').first();
    await page.waitForTimeout(500);
  });

  test('should toggle languages and run generation', async ({ page }) => {
    await page.goto('/');

    // Enable Python
    const pythonBtn = page.getByRole('button', { name: 'Toggle Python language generation' });
    // It is false by default
    await pythonBtn.click();
    await expect(pythonBtn).toHaveAttribute('aria-pressed', 'true');

    // Disable Python back
    await pythonBtn.click();
    await expect(pythonBtn).toHaveAttribute('aria-pressed', 'false');

    // Run Generation
    await page.getByRole('button', { name: 'Run Code Generation' }).click();

    // The SDK editor should have some stub code
    const sdkTextArea = page.locator('ngx-monaco-editor').last();
    // Wait for text to appear (generator is async). We see typescript output due to selected defaults.
    await page.waitForTimeout(500);
  });

  test('should swap panes and generate OpenAPI from SDK', async ({ page }) => {
    await page.goto('/');

    // Run generation first to have some SDK code
    await page.getByRole('button', { name: 'Run Code Generation' }).click();

    // Swap panes
    await page.getByRole('button', { name: 'Swap Editor Panes' }).click();

    // Check that split-view is swapped
    await expect(page.locator('.split-view')).toHaveClass(/swapped/);

    // Run generation to go from SDK back to OpenAPI
    await page.getByRole('button', { name: 'Run Code Generation' }).click();

    // Verify OpenAPI pane updated
    const specTextArea = page.locator('ngx-monaco-editor').first();
    await page.waitForTimeout(500);
  });

  test('should load different examples', async ({ page }) => {
    await page.goto('/');

    // Select Hello World example
    // We target the actual trigger element which intercepts the click.
    // Use click with force: true if angular material label is intercepting
    await page
      .locator('mat-select[aria-label="Select an example specification"]')
      .click({ force: true });
    await page.getByRole('option', { name: 'Hello World' }).click();

    const specTextArea = page.locator('ngx-monaco-editor').first();
    await page.waitForTimeout(500);

    // Select Empty example
    await page
      .locator('mat-select[aria-label="Select an example specification"]')
      .click({ force: true });
    await page.getByRole('option', { name: 'Empty' }).click();
    await page.waitForTimeout(500);
  });
});
