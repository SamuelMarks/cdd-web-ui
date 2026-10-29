import { test, expect } from '@playwright/test';
import { LANGUAGES } from '../src/app/models/constants';

test.describe('WASM E2E Tests (All 13 cdd-${LANGUAGE} compilers, from_openapi and to_openapi)', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    const preloadFailures: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('Failed to preload')) {
        preloadFailures.push(msg.text());
      }
    });
    await page.route('**/*google-analytics*', (route) => route.abort());
    await page.goto('/');
    const loadWasmBtn = page.locator('button', { hasText: /Load ~.*MB of WASM/i });
    if (await loadWasmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loadWasmBtn.click();
      const progressContainer = page.locator('.progress-container, .spinner-container');
      await expect(progressContainer).toBeHidden({ timeout: 120000 });
    }

    await page.waitForSelector('.workspace-container', { state: 'visible', timeout: 120000 });
    expect(preloadFailures).toEqual([]);
  });

  for (const lang of LANGUAGES) {
    test(`Real WASM Generation (from_openapi & to_openapi) for ${lang.name}`, async ({ page }) => {
      if (!lang.availableInWasm) {
        test.skip(true, `WASM not available for ${lang.name}`);
        return;
      }

      const langSelect = page.locator('mat-select[aria-label="Select Target Language"]');
      await langSelect.click();

      const langOption = page.locator('mat-option').filter({ hasText: lang.name }).first();
      await langOption.click();

      const generateBtn = page.locator('button', { hasText: /Generate/i }).first();
      await generateBtn.click();
      await expect(generateBtn).toBeEnabled({ timeout: 120000 });
      await expect(page.locator('mat-form-field.has-error')).toHaveCount(0);

      const codeViewer = page.locator('.code-viewer-container');
      await expect(codeViewer).toBeVisible({ timeout: 120000 });
      const firstFileItem = page.locator('app-directory-tree li[role="treeitem"] .node').first();
      await expect(firstFileItem).toBeVisible({ timeout: 120000 });
      await firstFileItem.click();
      const codeEditorContent = page.locator('.monaco-editor').first();
      await expect(codeEditorContent).toBeVisible({ timeout: 120000 });
      const textContent = await codeEditorContent.textContent();
      expect(textContent?.length).toBeGreaterThan(0);

      // Swap orientation to test to_openapi (code -> OpenAPI)
      const swapButton = page.locator('button[aria-label="Swap Panes"]');
      await swapButton.click();
      await generateBtn.click();
      await expect(generateBtn).toBeEnabled({ timeout: 120000 });
      await expect(page.locator('mat-form-field.has-error')).toHaveCount(0);
    });
  }
});
