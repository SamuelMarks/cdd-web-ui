import { test, expect } from '@playwright/test';
import { LANGUAGES } from '../src/app/models/constants';

// We are starting with just C++ and will add others as we fix them
const SUPPORTED_E2E_LANGUAGES = [
  'cpp',
  'c',
  'csharp',
  'go',
  'kotlin',
  'php',
  'ruby',
  'rust',
  'sh',
  'swift',
  'typescript',
  'python',
  'java',
];

test.describe('SDK Examples UI Integration Tests', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/*google-analytics*', (route) => route.abort());
    await page.goto('/');
    const loadWasmBtn = page.locator('button', { hasText: /Load ~.*MB of WASM/i });
    if (await loadWasmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loadWasmBtn.click();
      const progressContainer = page.locator('.progress-container, .spinner-container');
      await expect(progressContainer).toBeHidden({ timeout: 60000 });
    }
  });

  const languagesToTest = LANGUAGES.filter((l) => SUPPORTED_E2E_LANGUAGES.includes(l.id));

  for (const lang of languagesToTest) {
    if (!lang.availableInWasm) {
      continue;
    }

    test('Generates SDK example for ' + lang.name + ' and renders in Docs UI', async ({ page }) => {
      const workspaceContainer = page.locator('.workspace-container');
      await expect(workspaceContainer).toBeVisible({ timeout: 60000 });

      const langSelect = page.locator('mat-select[aria-label="Select Target Language"]');
      await langSelect.click();
      const langOption = page.locator('mat-option').filter({ hasText: lang.name }).first();
      await langOption.click();

      const notSupportedBox = page.locator('.offline-unsupported');
      if (await notSupportedBox.isVisible()) {
        test.skip(true, 'Skipping WASM run for ' + lang.name + ' (Not Supported)');
      }

      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning')
          errors.push(msg.type() + ': ' + msg.text());
      });

      const generateBtn = page.locator('button', { hasText: /Generate/i });
      await expect(generateBtn).toBeEnabled({ timeout: 30000 });
      await generateBtn.click();

      // Wait for generation to start (button disables)
      try {
        await expect(generateBtn).toBeDisabled({ timeout: 5000 });
      } catch (e) {
        // If it finished instantly, that's fine too
      }
      // Wait for generation to finish (button re-enables)
      await expect(generateBtn).toBeEnabled({ timeout: 120000 });

      const tabGroup = page.locator('mat-tab-group');
      const docsUiTab = tabGroup.locator('div[role="tab"]', { hasText: /Docs UI/i });
      await docsUiTab.click();

      const cddApiDocs = page.locator('cdd-api-docs').first();
      await expect(cddApiDocs).toBeVisible({ timeout: 60000 });

      let langId = lang.id;
      if (langId === 'c') langId = 'c89';

      const targetLangTab = cddApiDocs
        .locator('label.cdd-setting-label', { hasText: new RegExp('^' + langId + '$', 'i') })
        .first();
      if (await targetLangTab.isVisible()) {
        await targetLangTab.click();
      }

      // Automatically uncheck imports and wrapping if they are checked
      // since many generators might not support generating them in `to_docs_json` mode.
      const importsLabel = cddApiDocs
        .locator('label.cdd-setting-label', { hasText: /Include Imports/i })
        .first();
      if (await importsLabel.isVisible()) {
        const importsInput = cddApiDocs.locator('#opt-imports');
        if (await importsInput.isChecked()) {
          await importsLabel.click();
        }
      }

      const wrappingLabel = cddApiDocs
        .locator('label.cdd-setting-label', { hasText: /Include Wrapping/i })
        .first();
      if (await wrappingLabel.isVisible()) {
        const wrappingInput = cddApiDocs.locator('#opt-wrapping');
        if (await wrappingInput.isChecked()) {
          await wrappingLabel.click();
        }
      }

      // Click the SDK tab to make it visible
      const sdkTab = cddApiDocs.locator('label.cdd-tab-label', { hasText: /^SDK$/ }).first();
      if (await sdkTab.isVisible()) {
        await sdkTab.click();
      }

      const codeBlock = cddApiDocs.locator('.cdd-tab-content-sdk pre code').first();

      try {
        await expect(codeBlock).toBeVisible({ timeout: 60000 });
      } catch (e) {
        const examples = await cddApiDocs.evaluate((node: any) => JSON.stringify(node.sdkExamples));
        throw new Error(
          'Code block not visible for ' +
            lang.name +
            '!\nExamples:\n' +
            examples +
            '\nErrors:\n' +
            errors.join('\n'),
        );
      }

      const codeText = await codeBlock.textContent();
      expect(codeText?.trim().length).toBeGreaterThan(0);
    });
  }
});
