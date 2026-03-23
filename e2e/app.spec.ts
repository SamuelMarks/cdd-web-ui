import { test, expect } from '@playwright/test';
import { LANGUAGES } from '../src/app/models/constants';

const ALL_LANGUAGES = LANGUAGES.map(l => l.id);

test.describe('App E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Mock backend/WASM interception layer for deterministic E2E testing
    const wasmSupportMap = ALL_LANGUAGES.reduce((acc, lang) => {
      acc[lang] = true; // Mock all languages as supported for E2E
      return acc;
    }, {} as Record<string, boolean>);

    await page.route('**/assets/wasm-support.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wasmSupportMap)
      });
    });

    // Mock WASM downloading to avoid heavy builds and network failures in tests
    // A valid empty wasm module (magic header \0asm + version)
    const dummyWasm = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    await page.route('**/assets/wasm/*.wasm', async (route) => {
       await route.fulfill({
         status: 200,
         contentType: 'application/wasm',
         body: dummyWasm
       });
    });
  });

  test('App loads and displays split pane', async ({ page }) => {
    await page.goto('/');
    
    // Title check
    await expect(page).toHaveTitle(/CDD Web UI/i);
    
    // Verify split pane container is visible
    const splitPane = page.locator('.split-pane-container');
    await expect(splitPane).toBeVisible();

    // Verify left and right panes exist
    await expect(page.locator('.pane-left')).toBeVisible();
    await expect(page.locator('.pane-right')).toBeVisible();
  });

  for (const lang of LANGUAGES) {
    test(`Language UI interactions: ${lang.name}`, async ({ page }) => {
      await page.goto('/');

      // Wait for app load
      await page.waitForSelector('mat-select[aria-label="Select Target Language"]');

      // Click the language dropdown
      const langSelect = page.locator('mat-select[aria-label="Select Target Language"]');
      await langSelect.click();

      // Wait for options panel and select the language
      const option = page.locator('mat-option').filter({ hasText: lang.name }).first();
      await option.click();

      // Verify selection changed
      await expect(langSelect).toContainText(lang.name);

      // Now test Targets
      const targetSelect = page.locator('mat-select[aria-label="Select Target Output"]');
      await targetSelect.waitFor({ state: 'visible' });

      // Loop through a few targets
      const targets = ['Client SDK', 'Client CLI', 'Server'];
      for (const targetName of targets) {
        await targetSelect.click();
        const targetOption = page.getByRole('option', { name: targetName, exact: true });
        await targetOption.click();
        // Wait for dropdown to close
        await expect(targetOption).toBeHidden();
        await expect(targetSelect).toContainText(targetName);

        // Verify options panel renders correct checkboxes based on language and target
        if (lang.id === 'typescript') {
           if (targetName === 'Client SDK') {
             const fwSelect = page.locator('mat-select', { hasText: /(Framework target|Angular|Fetch|Axios)/i }).first();
             await expect(fwSelect).toBeVisible();
             await expect(page.locator('mat-checkbox', { hasText: 'Auto-admin' })).toBeVisible();
           } else if (targetName === 'Client CLI') {
             const fwSelect = page.locator('mat-select', { hasText: /(Framework target|Fetch|Axios)/i }).first();
             await expect(fwSelect).toBeVisible();
             await expect(page.locator('mat-checkbox', { hasText: 'Auto-admin' })).toBeVisible();
           }
        }
        
        if (['java', 'php', 'python', 'ruby', 'swift'].includes(lang.id)) {
          await expect(page.locator('mat-checkbox', { hasText: 'No GitHub Actions' })).toBeVisible();
          await expect(page.locator('mat-checkbox', { hasText: 'No Installable Package' })).toBeVisible();
        }
      }
    });
  }

  test('Verify Theme switching (Light/Dark)', async ({ page }) => {
    await page.goto('/');
    
    const themeToggle = page.locator('.theme-toggle');
    const icon = themeToggle.locator('.theme-icon');
    
    // Get initial state
    const iconText1 = await icon.innerText();
    
    // Toggle
    await themeToggle.click({ force: true });
    
    // Verify it changed
    const iconText2 = await icon.innerText();
    expect(iconText1).not.toEqual(iconText2);
    expect(iconText1 === '☀' || iconText1 === '☾').toBeTruthy();
  });

  test('User clicks Swap ⇆ -> verifies left/right swap', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.workspace-toolbar');

    let leftPane = page.locator('.pane-left');
    await expect(leftPane.locator('.toolbar-title').filter({ hasText: 'OpenAPI Spec' })).toBeVisible();

    const swapButton = page.locator('button[aria-label="Swap Panes"]');
    await expect(swapButton).toBeEnabled();
    await swapButton.click();

    let rightPane = page.locator('.pane-right');
    await expect(rightPane.locator('.toolbar-title').filter({ hasText: 'OpenAPI Spec' })).toBeVisible();
  });

});

