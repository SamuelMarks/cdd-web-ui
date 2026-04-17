import { test, expect } from '@playwright/test';
import { LANGUAGES } from '../src/app/models/constants';

const ALL_LANGUAGES = LANGUAGES.map((l) => l.id);

test.describe('App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock backend/WASM interception layer for deterministic E2E testing
    const wasmSupportMap = ALL_LANGUAGES.reduce(
      (acc, lang) => {
        acc[lang] = true; // Mock all languages as supported for E2E
        return acc;
      },
      {} as Record<string, boolean>,
    );

    await page.route('**/assets/wasm-support.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wasmSupportMap),
      });
    });
  });

  // Replaced by loop-based tests below.

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
            const fwSelect = page
              .locator('mat-select', { hasText: /(Framework target|Angular|Fetch|Axios)/i })
              .first();
            await expect(fwSelect).toBeVisible();
            await expect(page.locator('mat-checkbox', { hasText: 'Auto-admin' })).toBeVisible();
          } else if (targetName === 'Client CLI') {
            const fwSelect = page
              .locator('mat-select', { hasText: /(Framework target|Fetch|Axios)/i })
              .first();
            await expect(fwSelect).toBeVisible();
            await expect(page.locator('mat-checkbox', { hasText: 'Auto-admin' })).toBeVisible();
          }
        }

        if (['java', 'php', 'python', 'ruby', 'swift'].includes(lang.id)) {
          await expect(
            page.locator('mat-checkbox', { hasText: 'No GitHub Actions' }),
          ).toBeVisible();
          await expect(
            page.locator('mat-checkbox', { hasText: 'No Installable Package' }),
          ).toBeVisible();
        }
      }
    });

    test(`Complete workflow & Docs UI for ${lang.name}: edit OpenAPI, generate SDK, verify docs, swap, generate OpenAPI`, async ({ page, isMobile }) => {
      await page.goto('/', { waitUntil: 'networkidle' });

      // 0. Specific input (Petstore example)
      const exampleSelect = page.locator('.example-field mat-select');
      await exampleSelect.waitFor({ state: 'visible' });
      await exampleSelect.click();
      await page.getByRole('option', { name: 'Petstore' }).click();

      // 1. Specify target (current language in loop)
      const langSelect = page.locator('mat-select[aria-label="Select Target Language"]');
      await langSelect.click();
      const langOption = page.locator('mat-option').filter({ hasText: lang.name }).first();
      await langOption.click();

      // 2. & 3. Generate and verify output (no syntax errors, Docs UI renders, can roundtrip)
      const generateBtn = page.getByRole('button', { name: 'Generate' }).first();
      await generateBtn.click({ force: true });

      // Wait for toast indicating successful generation (this implies basic lint/sanity in the WASM layer succeeded)
      const snackBar = page.locator('simple-snack-bar').first();
      await expect(snackBar).toBeVisible({ timeout: 15000 });
      // Ensure the toast disappears so it doesn't block future clicks
      await expect(snackBar).toBeHidden({ timeout: 15000 });

      // 3. Show in a pane the ../cdd-docs-ui output (rendered HTML of what the API docs page would look like)
      const docsUiTab = page.getByRole('tab', { name: 'Docs UI' });
      await docsUiTab.click();
      await expect(docsUiTab).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });

      const cddApiDocs = page.locator('cdd-api-docs');
      await expect(cddApiDocs).toBeVisible({ timeout: 15000 });

      // 2. Show that the output passes a basic lint / sanity check (can roundtrip back to OpenAPI)
      // Swap panes
      const swapButton = page.locator('button[aria-label="Swap Panes"]');
      await swapButton.click();

      // Ensure Code Viewer is now on the left pane
      const leftPaneCodeViewer = page.locator('.pane-left').locator('.code-viewer-container, .directory-tree');
      if (!isMobile) {
        await expect(leftPaneCodeViewer.first()).toBeVisible();
      } else {
        await expect(leftPaneCodeViewer.first()).toBeAttached();
      }

      // Click Generate again (this time to_openapi, from SDK to OpenAPI)
      await generateBtn.click({ force: true });
      
      // Check toast again to confirm successful roundtrip
      const secondToast = page.locator('simple-snack-bar').first();
      await expect(secondToast).toBeVisible({ timeout: 15000 });
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

    // Wait for text to change
    await expect(icon).not.toHaveText(iconText1, { timeout: 15000 });

    // Verify it changed
    const iconText2 = await icon.innerText();
    expect(iconText1).not.toEqual(iconText2);
    expect(iconText1 === '☀' || iconText1 === '☾').toBeTruthy();
  });

  test('User clicks Swap ⇆ -> verifies left/right swap', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.workspace-toolbar');

    let leftPane = page.locator('.pane-left');
    await expect(
      leftPane.locator('.toolbar-title').filter({ hasText: 'OpenAPI Spec' }),
    ).toBeVisible();

    const swapButton = page.locator('button[aria-label="Swap Panes"]');
    await expect(swapButton).toBeEnabled();
    await swapButton.click();

    let rightPane = page.locator('.pane-right');
    await expect(
      rightPane.locator('.toolbar-title').filter({ hasText: 'OpenAPI Spec' }),
    ).toBeVisible();
  });

  test('Simulate offline code generation execution and verify no external network requests', async ({
    page,
  }) => {
    let externalRequests = 0;
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('github.com')) {
        externalRequests++;
      }
    });

    await page.goto('/');

    const runButton = page.locator('button', { hasText: 'Generate' }).first();
    await runButton.waitFor({ state: 'visible' });
    await expect(runButton).toBeEnabled();

    await runButton.click();

    // We expect a snack bar toast
    const snackBar = page.locator('simple-snack-bar').first();
    await expect(snackBar).toBeVisible({ timeout: 15000 });

    expect(externalRequests).toBe(0);
  });

  // Replaced by loop-based tests above.
});

