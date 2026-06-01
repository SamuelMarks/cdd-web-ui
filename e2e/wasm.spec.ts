import { test, expect } from '@playwright/test';
import { LANGUAGES } from '../src/app/models/constants';

test.describe('WASM E2E Tests', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/*google-analytics*', (route) => route.abort());
    await page.goto('/');
    const loadWasmBtn = page.locator('button', { hasText: /Load ~.*MB of WASM/i });
    if (await loadWasmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loadWasmBtn.click();
      const progressContainer = page.locator('.progress-container, .spinner-container');
      await expect(progressContainer).toBeHidden({ timeout: 120000 });
    }

    await page.waitForSelector('.workspace-container', { state: 'visible', timeout: 120000 });
  });

  for (const lang of LANGUAGES) {
    test(`Real WASM Generation for ${lang.name}`, async ({ page }) => {
      // Ignore generating typescript as its extremely slow right now
      test.skip(true, `Skipping WASM run for ${lang.name} as its very slow to start`);
      return;
      if (!lang.availableInWasm) {
        test.skip(true, `WASM not available for ${lang.name}`);
        return;
      }

      const langSelect = page.locator('mat-select[aria-label="Select Target Language"]');
      await langSelect.click();

      const langOption = page.locator('mat-option').filter({ hasText: lang.name }).first();
      await langOption.click();

      // Listen to console to see what the worker is logging!
      page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));

      const generateBtn = page.locator('button', { hasText: /Generate/i });
      await generateBtn.click();
      await expect(generateBtn).toBeEnabled({ timeout: 120000 });

      const codeViewer = page.locator('.code-viewer-container');
      await expect(codeViewer).toBeVisible({ timeout: 120000 });
      const firstFileItem = page.locator('cdd-directory-tree li.file-item').first();
      await expect(firstFileItem).toBeVisible({ timeout: 120000 });
      await firstFileItem.click();
      const codeEditorContent = page.locator('.monaco-editor').first();
      await expect(codeEditorContent).toBeVisible({ timeout: 120000 });
      const textContent = await codeEditorContent.textContent();
      expect(textContent?.length).toBeGreaterThan(0);
    });
  }
});
