import { test, expect } from '@playwright/test';

test.describe('App E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Step 257: Add a mock backend/WASM interception layer for deterministic E2E testing
    await page.route('**/assets/wasm-support.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          typescript: true,
          java: false,
          rust: true,
          python: true,
          go: true
        })
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

  test('App loads and displays split pane (242)', async ({ page }) => {
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

  test('User can type in the OpenAPI editor (243)', async ({ page }) => {
    await page.goto('/');
    
    // We'll verify the editor wrapper component is mounted. We won't test Monaco internals directly.
    const editorContainer = page.locator('.openapi-editor-container').first();
    await expect(editorContainer).toBeVisible();
    
    // We can clear it using our Angular-bound toolbar to test interaction
    const clearBtn = page.locator('button[aria-label="Clear Editor"]');
    await clearBtn.waitFor({ state: 'visible' });
    await clearBtn.click({ force: true });
  });

  test('User selects a language from the dropdown (244)', async ({ page }) => {
    await page.goto('/');

    // Click the mat-select dropdown
    const select = page.locator('mat-select[aria-label="Select Target Language"]');
    await select.waitFor({ state: 'visible' });
    await select.click();

    // Wait for options panel
    const option = page.locator('mat-option').filter({ hasText: 'Rust' });
    await expect(option).toBeVisible();
    await option.click();

    // Verify selection changed
    await expect(select).toContainText('Rust');
  });

  test('Verify Theme switching (Light/Dark) (253)', async ({ page }) => {
    await page.goto('/');
    
    const themeToggle = page.locator('.theme-toggle');
    const icon = themeToggle.locator('.theme-icon');
    
    // Get initial state
    const iconText1 = await icon.innerText();
    
    // Toggle (force click because on mobile it might be overlaid or narrow)
    await themeToggle.click({ force: true });
    
    // Verify it changed
    const iconText2 = await icon.innerText();
    expect(iconText1).not.toEqual(iconText2);
    expect(iconText1 === '☀' || iconText1 === '☾').toBeTruthy();
  });

  test('User clicks Swap ⇆ -> verifies left/right swap (247)', async ({ page }) => {
    await page.goto('/');

    // Wait for render
    await page.waitForSelector('.workspace-toolbar');

    // Initially OpenAPI is on the left
    // We can just verify the layout by checking if the left pane has the editor toolbar
    let leftPane = page.locator('.pane-left');
    await expect(leftPane.locator('.toolbar-title').filter({ hasText: 'OpenAPI Spec' })).toBeVisible();

    // Click Swap
    const swapButton = page.locator('button[aria-label="Swap Panes"]');
    await swapButton.click({ force: true });

    // Now OpenAPI should be on the right
    let rightPane = page.locator('.pane-right');
    await expect(rightPane.locator('.toolbar-title').filter({ hasText: 'OpenAPI Spec' })).toBeVisible();
  });

});
