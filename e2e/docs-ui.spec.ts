import { test, expect } from '@playwright/test';
import { LANGUAGES } from '../src/app/models/constants';

const SUPPORTED_E2E_LANGUAGES = ['c', 'cpp', 'go', 'php', 'rust', 'ruby', 'swift', 'typescript']; // Excluded python, csharp, java, kotlin for now

test.describe('SDK Examples UI Integration Tests', () => {
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
  });

  const languagesToTest = LANGUAGES.filter((l) => SUPPORTED_E2E_LANGUAGES.includes(l.id));

  for (const lang of languagesToTest) {
    if (!lang.availableInWasm) continue;

    test('Generates SDK example for ' + lang.name + ' and renders in Docs UI', async ({ page }) => {
      const workspaceContainer = page.locator('.workspace-container');
      await expect(workspaceContainer).toBeVisible({ timeout: 120000 });

      const langSelect = page.locator('mat-select[aria-label="Select Target Language"]');
      await langSelect.click();
      const langOption = page.locator('mat-option').filter({ hasText: lang.name }).first();
      await langOption.click();

      const generateBtn = page.locator('button', { hasText: /Generate/i });
      await generateBtn.click();
      await expect(generateBtn).toBeEnabled({ timeout: 120000 });

      const tabGroup = page.locator('mat-tab-group');
      const docsUiTab = tabGroup.locator('div[role="tab"]', { hasText: /Docs UI/i });
      await docsUiTab.click();

      const cddApiDocs = page.locator('cdd-api-docs').first();
      await expect(cddApiDocs).toBeVisible({ timeout: 120000 });

      // Wait until the first SDK tab is visible
      const sdkTab = cddApiDocs.locator('label.cdd-tab-label', { hasText: /^SDK$/ }).first();
      await expect(sdkTab).toBeVisible({ timeout: 120000 });
      await sdkTab.click();

      const codeBlock = cddApiDocs.locator('.cdd-tab-content-sdk pre code').first();

      const codeText = await codeBlock.textContent();
      expect(codeText?.trim().length).toBeGreaterThan(0);

      const lower = codeText?.toLowerCase() || '';
      expect(lower).not.toContain('mock generated code');
      expect(lower).toContain('pet');
    });
  }
});
