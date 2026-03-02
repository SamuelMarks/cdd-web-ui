import { test, expect } from '@playwright/test';

test.describe('Dashboard and Repository Workflow', () => {
  // Clear localStorage before starting so tests run isolated
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard');
  });

  test('should create user, organization, and repository', async ({ page }) => {
    // 1. Create User
    await expect(page.locator('mat-card-title').first()).toContainText('CDD Dashboard');

    // Fill user input
    await page.locator('input[formControlName="login"]').fill('Test User');

    // Click button using exact text content matching for MatButton
    await page.getByRole('button', { name: 'Create new user' }).click();

    // Verify user is created
    await expect(page.locator('.dashboard-header h2')).toContainText('Welcome, Test User!');

    // 2. Create organization
    await page.locator('input[formControlName="login"]').fill('my-awesome-org');
    await page.getByRole('button', { name: 'Create Organization' }).click();

    // Verify organization is created in the grid
    const orgCard = page.locator('.org-card');
    await expect(orgCard).toHaveCount(1);
    await expect(orgCard.locator('mat-card-title')).toContainText('my-awesome-org');

    // 3. Navigate to organization
    await orgCard.click();
    await expect(page.locator('.organization-header h2')).toContainText(
      'Organization: my-awesome-org',
    );

    // 4. Create Repository
    await page.locator('input[formControlName="name"]').fill('awesome-api-repo');
    await page.getByRole('button', { name: 'Create new repository' }).click();

    // Verify repository is created
    const repoCard = page.locator('.repo-card');
    await expect(repoCard).toHaveCount(1);
    await expect(repoCard.locator('mat-card-title')).toContainText('awesome-api-repo');

    // 5. Navigate to Editor for Repository
    await repoCard.click();

    // Check breadcrumb
    await expect(page.locator('.breadcrumb strong')).toContainText('awesome-api-repo');

    // Fill the spec editor
    const specTextArea = page.locator('textarea.code-editor').first();
    await specTextArea.fill('openapi: 3.0.0\ninfo:\n  title: My API');

    // Save some code to the repository
    await page.getByRole('button', { name: 'Run Code Generation' }).click();

    // Check that we have valid client code inside
    const sdkTextArea = page.locator('textarea.code-editor').last();
    await expect(sdkTextArea).toHaveValue(/Client/);

    // Verify it saved the spec (by navigating back and forward)
    await page.locator('.breadcrumb a').click();
    await repoCard.click();

    // Check the loaded spec is still there
    const reloadedSpecTextArea = page.locator('textarea.code-editor').first();
    await expect(reloadedSpecTextArea).toHaveValue(/openapi: 3.0.0/);
  });
});
