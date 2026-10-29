import { test, expect } from '@playwright/test';
import { LANGUAGES } from '../src/app/models/constants';

const ALL_LANGUAGES = LANGUAGES.map((l) => l.id);

test.describe('App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock backend/WASM interception layer for deterministic E2E testing
    await page.addInitScript(() => {
      class MockWorker {
        listeners: ((event: { data: unknown }) => void)[] = [];
        constructor() {}
        postMessage(msg: {
          action: string;
          jobId: string;
          payload: { target?: string; ecosystem?: string };
        }): void {
          setTimeout(() => {
            if (msg.action === 'generateSdk') {
              let res: {
                status: string;
                jobId: string;
                data: { path: string; content: Uint8Array }[];
              };
              if (msg.payload.target && msg.payload.target.startsWith('to_openapi')) {
                res = {
                  status: 'success',
                  jobId: msg.jobId,
                  data: [
                    {
                      path: 'openapi.json',
                      content: new TextEncoder().encode(
                        '{"openapi":"3.2.0","info":{"title":"Generated","version":"1.0.0"},"paths":{}}',
                      ),
                    },
                  ],
                };
              } else if (msg.payload.target === 'to_docs_json') {
                res = {
                  status: 'success',
                  jobId: msg.jobId,
                  data: [
                    {
                      path: 'docs.json',
                      content: new TextEncoder().encode(
                        '{"endpoints":{"/pet":{"get":"// SDK snippet"}}}',
                      ),
                    },
                  ],
                };
              } else {
                res = {
                  status: 'success',
                  jobId: msg.jobId,
                  data: [{ path: 'mock.txt', content: new TextEncoder().encode('mocked') }],
                };
              }
              this.listeners.forEach((l) => l({ data: res }));
            }
          }, 10);
        }
        addEventListener(event: string, handler: (event: { data: unknown }) => void): void {
          if (event === 'message') this.listeners.push(handler);
        }
        removeEventListener(event: string, handler: (event: { data: unknown }) => void): void {
          if (event === 'message') this.listeners = this.listeners.filter((l) => l !== handler);
        }
        terminate(): void {}
      }
      (window as unknown as { Worker: typeof MockWorker }).Worker = MockWorker;
    });

    const wasmSupportMap = ALL_LANGUAGES.reduce<Record<string, boolean>>((acc, lang) => {
      let key = lang;
      if (lang === 'typescript') key = 'ts';
      if (lang === 'openapi') key = 'cpp';
      acc[key] = true; // Mock all languages as supported for E2E
      return acc;
    }, {});

    await page.route('**/assets/wasm-support.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wasmSupportMap),
      });
    });

    await page.route('**/assets/wasm/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/wasm',
        body: Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
      });
    });
  });

  for (const lang of LANGUAGES) {
    test(`Language UI interactions & option selection without error: ${lang.name}`, async ({
      page,
    }) => {
      await page.goto('/');
      const loadWasmBtn = page.getByRole('button', { name: 'Load ~72MB of WASM' });
      await loadWasmBtn.waitFor({ state: 'visible' });
      await loadWasmBtn.click();

      // Wait for app load
      await page.waitForSelector('mat-select[aria-label="Select Target Language"]');

      // Click the language dropdown
      const langSelect = page.locator('mat-select[aria-label="Select Target Language"]');
      await langSelect.click();

      // Wait for options panel and select the language
      const option = page.locator('mat-option').filter({ hasText: lang.name }).first();
      await option.click();

      // Verify selection changed and no error state is present
      await expect(langSelect).toContainText(lang.name);
      await expect(page.locator('mat-form-field.has-error')).toHaveCount(0);

      if (lang.id === 'openapi') {
        await expect(page.locator('mat-checkbox', { hasText: 'Enable Tests' })).toBeVisible();
        await expect(page.locator('mat-form-field.has-error')).toHaveCount(0);
        return;
      }

      // Now test Targets
      const targetSelect = page.locator('mat-select[aria-label="Select Target Output"]');
      await targetSelect.waitFor({ state: 'visible' });

      const targets =
        lang.id === 'typescript'
          ? ['Client SDK', 'Client CLI', 'MCP Server', 'Server', 'ORM Entities']
          : ['Client SDK', 'Client CLI', 'MCP Server', 'Server'];

      for (const targetName of targets) {
        await targetSelect.click();
        const targetOption = page.getByRole('option', { name: targetName, exact: true });
        await targetOption.click();
        await expect(targetOption).toBeHidden();
        await expect(targetSelect).toContainText(targetName);
        await expect(page.locator('mat-form-field.has-error')).toHaveCount(0);

        if (lang.id === 'typescript') {
          if (targetName === 'Client SDK') {
            const fwSelect = page.locator('mat-select[aria-label="Select Client Framework"]');
            await expect(fwSelect).toBeVisible();
            for (const fwName of ['Vanilla JS', 'Angular', 'React', 'Vue']) {
              await fwSelect.click();
              const fwOption = page.getByRole('option', { name: fwName, exact: true });
              await fwOption.click();
              await expect(fwOption).toBeHidden();
              await expect(page.locator('mat-form-field.has-error')).toHaveCount(0);
            }
            const autoAdminCheckbox = page.locator('mat-checkbox', { hasText: 'Auto-admin' });
            await expect(autoAdminCheckbox).toBeVisible();
            await autoAdminCheckbox.click();
            await expect(page.locator('mat-form-field.has-error')).toHaveCount(0);
          } else if (targetName === 'Client CLI') {
            const fwSelect = page.locator('mat-select[aria-label="Select Client Framework"]');
            await expect(fwSelect).toBeVisible();
            await expect(page.locator('mat-checkbox', { hasText: 'Auto-admin' })).toBeVisible();
            await expect(page.locator('mat-checkbox', { hasText: 'MCP' })).toBeVisible();
          } else if (targetName === 'Server') {
            const sfwSelect = page.locator('mat-select[aria-label="Select Server Framework"]');
            await expect(sfwSelect).toBeVisible();
            for (const sfwName of ['Express', 'Node.js HTTP', 'Bun', 'Deno']) {
              await sfwSelect.click();
              const sfwOption = page.getByRole('option', { name: sfwName, exact: true });
              await sfwOption.click();
              await expect(sfwOption).toBeHidden();
              await expect(page.locator('mat-form-field.has-error')).toHaveCount(0);
            }
            await expect(page.locator('mat-checkbox', { hasText: 'Services' })).toBeVisible();
          } else if (targetName === 'ORM Entities') {
            const ormSelect = page.locator('mat-select[aria-label="Select ORM Engine"]');
            await expect(ormSelect).toBeVisible();
          }
        }

        if (targetName === 'Server' && ['ruby', 'php', 'kotlin'].includes(lang.id)) {
          await expect(
            page.locator('mat-checkbox', { hasText: 'Sandbox (Ephemeral)' }),
          ).toBeVisible();
          await expect(page.locator('mat-checkbox', { hasText: 'Mock Seed' })).toBeVisible();
        }

        if (targetName !== 'MCP Server') {
          await expect(page.locator('mat-checkbox', { hasText: 'CI' })).toBeVisible();
        }

        if (lang.id !== 'sh') {
          await expect(page.locator('mat-checkbox', { hasText: 'Package' })).toBeVisible();
        }
      }
    });

    test(`Complete workflow & Docs UI for ${lang.name}: edit OpenAPI, generate SDK, verify docs, swap, generate OpenAPI`, async ({
      page,
      isMobile,
    }) => {
      await page.goto('/');
      const loadWasmBtn = page.getByRole('button', { name: 'Load ~72MB of WASM' });
      await loadWasmBtn.waitFor({ state: 'visible' });
      await loadWasmBtn.click();

      // 0. Specific input (Petstore example)
      const exampleSelect = page.locator('.example-field mat-select');
      await exampleSelect.waitFor({ state: 'visible' });
      await exampleSelect.click();
      await page.getByRole('option', { name: 'Petstore' }).click();

      // Ensure input format is OpenAPI 3.2.0
      const formatSelect = page
        .locator('mat-select', {
          hasText: /Swagger | OpenAPI < 3\.2\.0|OpenAPI 3\.2\.0|Google Discovery/i,
        })
        .first();
      await formatSelect.click();
      await page.getByRole('option', { name: 'OpenAPI 3.2.0' }).click();

      // 1. Specify target (current language in loop)
      const langSelect = page.locator('mat-select[aria-label="Select Target Language"]');
      await langSelect.click();
      const langOption = page.locator('mat-option').filter({ hasText: lang.name }).first();
      await langOption.click();

      // 2. Generate from_openapi
      const generateBtn = page.getByRole('button', { name: 'Generate' }).first();
      await generateBtn.click({ force: true });

      const snackBar = page.locator('simple-snack-bar').first();
      await expect(snackBar).toContainText('Successfully', { timeout: 15000 });
      await expect(page.locator('mat-form-field.has-error')).toHaveCount(0);

      // 3. Verify Docs UI tab renders cdd-api-docs
      const docsUiTab = page.getByRole('tab', { name: 'Docs UI' });
      await docsUiTab.click();
      await expect(docsUiTab).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });

      const cddApiDocs = page.locator('cdd-api-docs');
      await expect(cddApiDocs).toBeVisible({ timeout: 15000 });

      // 4. Swap panes and run to_openapi
      const swapButton = page.locator('button[aria-label="Swap Panes"]');
      await swapButton.click();

      const leftPaneCodeViewer = page
        .locator('.pane-left')
        .locator('.code-viewer-container, .directory-tree');
      if (!isMobile) {
        await expect(leftPaneCodeViewer.first()).toBeVisible();
      } else {
        await expect(leftPaneCodeViewer.first()).toBeAttached();
      }

      await generateBtn.click({ force: true });

      const secondToast = page.locator('simple-snack-bar').first();
      await expect(secondToast).toContainText('Successfully', { timeout: 15000 });
      await expect(page.locator('mat-form-field.has-error')).toHaveCount(0);
    });
  }

  test('Verify Theme switching (Light/Dark)', async ({ page }) => {
    await page.goto('/');
    const loadWasmBtn = page.getByRole('button', { name: 'Load ~72MB of WASM' });
    await loadWasmBtn.waitFor({ state: 'visible' });
    await loadWasmBtn.click();

    const themeToggle = page.locator('.theme-toggle');
    const icon = themeToggle.locator('.theme-icon');

    const iconText1 = await icon.innerText();
    await themeToggle.click({ force: true });
    await expect(icon).not.toHaveText(iconText1, { timeout: 15000 });

    const iconText2 = await icon.innerText();
    expect(iconText1).not.toEqual(iconText2);
    expect(iconText1 === '☀' || iconText1 === '☾').toBeTruthy();
  });

  test('Verify OpenAPI Editor and URLs tabs interaction', async ({ page }) => {
    await page.route('https://example.com/spec1.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'Remote Spec 1', version: '1.0.0' },
          paths: { '/pets': { get: { operationId: 'listPets' } } },
        }),
      });
    });

    await page.goto('/');
    const loadWasmBtn = page.getByRole('button', { name: 'Load ~72MB of WASM' });
    await loadWasmBtn.waitFor({ state: 'visible' });
    await loadWasmBtn.click();

    const editorTab = page.getByRole('tab', { name: 'Editor' });
    const urlsTab = page.getByRole('tab', { name: 'URLs' });
    await expect(editorTab).toBeVisible();
    await expect(urlsTab).toBeVisible();

    await urlsTab.click();
    await expect(urlsTab).toHaveAttribute('aria-selected', 'true');

    const urlInput = page.locator('input[aria-label="OpenAPI URL #1"]');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://example.com/spec1.json');

    const addUrlBtn = page.getByRole('button', { name: 'Add OpenAPI URL' });
    await addUrlBtn.click();
    await expect(page.locator('input[aria-label="OpenAPI URL #2"]')).toBeVisible();
  });

  test('User clicks Swap ⇆ -> verifies left/right swap', async ({ page }) => {
    await page.goto('/');
    const loadWasmBtn = page.getByRole('button', { name: 'Load ~72MB of WASM' });
    await loadWasmBtn.waitFor({ state: 'visible' });
    await loadWasmBtn.click();
    await page.waitForSelector('.workspace-toolbar');

    const leftPane = page.locator('.pane-left');
    await expect(
      leftPane.locator('.toolbar-title').filter({ hasText: 'OpenAPI Spec' }),
    ).toBeVisible();

    const swapButton = page.locator('button[aria-label="Swap Panes"]');
    await expect(swapButton).toBeEnabled();
    await swapButton.click();

    const rightPane = page.locator('.pane-right');
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
    const loadWasmBtn = page.getByRole('button', { name: 'Load ~72MB of WASM' });
    await loadWasmBtn.waitFor({ state: 'visible' });
    await loadWasmBtn.click();

    const runButton = page.locator('button', { hasText: 'Generate' }).first();
    await runButton.waitFor({ state: 'visible' });
    await expect(runButton).toBeEnabled();

    await runButton.click();

    const snackBar = page.locator('simple-snack-bar').first();
    await expect(snackBar).toContainText('Successfully', { timeout: 15000 });

    expect(externalRequests).toBe(0);
  });
});
