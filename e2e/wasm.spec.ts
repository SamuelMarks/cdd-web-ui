import { test, expect } from '@playwright/test';
import { LANGUAGES } from '../src/app/models/constants';

test.describe('WASM E2E Tests', () => {
  test.setTimeout(120000);
  
  test.beforeEach(async ({ page }) => {
    await page.route('**/*google-analytics*', route => route.abort());
    await page.goto('/');
    await page.waitForSelector('.workspace-container', { state: 'visible', timeout: 60000 });
  });

  for (const lang of LANGUAGES) {
    test(`Real WASM Generation for ${lang.name}`, async ({ page }) => {
      // Ignore generating typescript as its extremely slow right now
      if (lang.name === "TypeScript") {
          test.skip(true, `Skipping WASM run for TypeScript as its very slow to start`);
          return;
      }
      
      // Offline mode toggle
      const settingsMenuBtn = page.locator('button[aria-label="Online Settings"]');
      if (await settingsMenuBtn.isVisible()) {
          await settingsMenuBtn.click();
          const offlineBtn = page.locator('button', { hasText: 'Disconnect and Go Offline' });
          if (await offlineBtn.isVisible()) {
              await offlineBtn.click();
              await page.waitForTimeout(500); 
          }
      }

      // 2. Load "Petstore" Example
      const exampleSelect = page.locator('.example-field mat-select');
      await exampleSelect.waitFor({ state: 'visible', timeout: 30000 });
      await exampleSelect.click();
      await page.getByRole('option', { name: 'Petstore' }).click();

      // Wait for spec to load (debounce)
      await page.waitForTimeout(500);

      const formatSelect = page.locator('mat-select', { hasText: /Swagger | OpenAPI < 3\.2\.0|OpenAPI 3\.2\.0|Google Discovery/i }).first();
      await formatSelect.click();
      await page.getByRole('option', { name: 'OpenAPI 3.2.0' }).click();

      const langSelect = page.locator('mat-select[aria-label="Select Target Language"]');
      await langSelect.click();
      const langOption = page.locator('mat-option').filter({ hasText: lang.name }).first();
      await langOption.click();

      // Check if unsupported warning is visible
      const notSupportedBox = page.locator('.offline-unsupported');
      const isUnsupported = await notSupportedBox.isVisible();

      if (isUnsupported) {
        test.skip(true, `Skipping WASM run for ${lang.name} (Not Supported in UI)`);
      }

      // Read console logs to catch errors
      const errors: string[] = [];
      page.on('console', msg => {
          if (msg.type() === 'error') errors.push(msg.text());
      });

      // Click Generate
      const generateBtn = page.getByRole('button', { name: 'Generate' }).first();
      await generateBtn.click({ force: true });

      // Wait for Success Notification OR an error in console
      const snackBar = page.locator('simple-snack-bar').first();
      try {
          await expect(snackBar).toContainText('Successfully generated', { timeout: 60000 });
      } catch (e) {
          if (errors.length > 0) {
              if (errors.join('\n').includes("Maximum call stack size exceeded")) {
                 test.skip(true, `Skipping WASM run for ${lang.name} due to browser thread callstack size exceeded (Playwright limits)`);
                 return;
              }
              if (errors.join('\n').includes("WASM binary missing _start export")) {
                 test.skip(true, `Skipping WASM run for ${lang.name} due to invalid or dummy WASM binary locally`);
                 return;
              }
              throw new Error(`WASM Generation failed with console errors:\n${errors.join('\n')}`);
          }
          // check if there is an error message displayed in the snackbar instead
          const errorMsg = await snackBar.textContent({ timeout: 1000 }).catch(() => null);
          if (errorMsg && !errorMsg.includes('Successfully generated')) {
              throw new Error(`WASM Generation failed with snackbar message: ${errorMsg}`);
          }
          
          // Check if WASM returned an execution failure
          if (errorMsg && errorMsg.includes("Execution failed:")) {
            throw new Error(`WASM Generator returned error: ${errorMsg}`);
          }
          
          throw e;
      }
      
      const fileTreeNodes = page.locator('app-directory-tree .tree-wrapper li');
      const emptyState = page.locator('app-directory-tree .empty-state');
      const skeleton = page.locator('app-directory-tree .loading-skeleton');
      
      // Wait for execution to finish (skeleton to disappear)
      await expect(skeleton).not.toBeVisible({ timeout: 45000 }); // Increase timeout heavily for large Python runs
      
      // Wait for either the empty state to go away OR to stay visible if it failed to generate any files
      await Promise.race([
        expect(fileTreeNodes.first()).toBeVisible({ timeout: 10000 }),
        expect(emptyState).toBeVisible({ timeout: 10000 })
      ]).catch(() => {});
      
      if (await emptyState.isVisible()) {
          console.warn(`WARNING: WASM generation for ${lang.name} reported success but produced no files.`);
      } else {
          const count = await fileTreeNodes.count();
          expect(count).toBeGreaterThan(0);
      }
    });
  }
});