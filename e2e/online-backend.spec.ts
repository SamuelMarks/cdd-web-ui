/**
 * End-to-End (E2E) Playwright specifications verifying complete integration with all
 * CDD backend microservices (`cdd-gateway`, `cdd-control-plane`, `cdd-engine`,
 * `cdd-storage`, `cdd-publisher`, and `cdd-docs-ui`), online workspace actions,
 * dashboard workflows, and WCAG AA accessibility landmarks.
 * @module e2e/online-backend.spec
 */

import { test, expect, Page } from '@playwright/test';
import { LANGUAGES } from '../src/app/models/constants';

const ALL_LANGUAGES = LANGUAGES.map((l) => l.id);
const MOCK_BACKEND_URL = 'http://localhost:8086';

/**
 * Configures deterministic WASM and backend microservice route mocks on the Playwright page.
 * @param page The Playwright Page instance under test.
 */
async function setupBackendAndWasmMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class MockWorker {
      listeners: ((event: { data: unknown }) => void)[] = [];
      postMessage(msg: { action: string; jobId: string }): void {
        setTimeout(() => {
          if (msg.action === 'generateSdk') {
            this.listeners.forEach((l) =>
              l({
                data: {
                  status: 'success',
                  jobId: msg.jobId,
                  data: [{ path: 'index.ts', content: new TextEncoder().encode('// sdk') }],
                },
              }),
            );
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
    acc[key] = true;
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

  // Mock cdd-gateway health & version
  await page.route(`${MOCK_BACKEND_URL}/health`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  });

  await page.route(`${MOCK_BACKEND_URL}/version`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        gateway: '0.1.0',
        ecosystem: { 'cdd-ts': '0.0.4', 'cdd-rust': '0.1.0' },
      }),
    });
  });

  // Mock cdd-control-plane health
  await page.route(`${MOCK_BACKEND_URL}/api/v1/health`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  });

  // Mock cdd-storage health, upload, download, and delete
  await page.route(`${MOCK_BACKEND_URL}/storage/health`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: 'OK',
    });
  });

  await page.route(`${MOCK_BACKEND_URL}/storage/upload/**`, async (route) => {
    await route.fulfill({ status: 201, body: '' });
  });

  await page.route(`${MOCK_BACKEND_URL}/storage/artifact/**`, async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204, body: '' });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"openapi":"3.2.0"}',
      });
    }
  });

  // Mock cdd-gateway auth endpoints
  await page.route(`${MOCK_BACKEND_URL}/auth/register`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'mock-jwt-token-registered' }),
    });
  });

  await page.route(`${MOCK_BACKEND_URL}/auth/login`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'mock-jwt-token-logged-in' }),
    });
  });

  await page.route(`${MOCK_BACKEND_URL}/auth/github`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'mock-jwt-token-github' }),
    });
  });

  // Mock cdd-control-plane account deletion
  await page.route(`${MOCK_BACKEND_URL}/api/v1/auth/me`, async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  // Mock cdd-control-plane & cdd-gateway Organizations
  await page.route(`${MOCK_BACKEND_URL}/api/v1/orgs`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, login: 'offscale', description: 'Offscale Org' },
        { id: 2, login: 'acme-corp', description: 'Acme Corp' },
      ]),
    });
  });

  await page.route(`${MOCK_BACKEND_URL}/orgs`, async (route) => {
    const body = route.request().postDataJSON() as { login: string };
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 3, login: body.login }),
    });
  });

  await page.route(`${MOCK_BACKEND_URL}/api/v1/orgs/*/members`, async (route) => {
    await route.fulfill({ status: 200, body: '' });
  });

  // Mock cdd-control-plane Repositories & Releases
  await page.route(`${MOCK_BACKEND_URL}/api/v1/orgs/*/repos`, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { name: string };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 101, organization_id: 1, name: body.name }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 10, organization_id: 1, name: 'offscale/cdd-ts' }]),
      });
    }
  });

  await page.route(`${MOCK_BACKEND_URL}/api/v1/orgs/*/repos/*/releases`, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { tag_name: string; name?: string };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 501,
          repository_id: 10,
          tag_name: body.tag_name,
          name: body.name || body.tag_name,
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 500, repository_id: 10, tag_name: 'v0.0.4' }]),
      });
    }
  });

  // Mock cdd-control-plane Tokens Vault
  await page.route(`${MOCK_BACKEND_URL}/api/v1/tokens`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['github', 'npm']),
      });
    }
  });

  await page.route(`${MOCK_BACKEND_URL}/api/v1/tokens/*`, async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  // Mock cdd-control-plane Audit Logs
  await page.route(`${MOCK_BACKEND_URL}/api/v1/orgs/*/audit*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 9001,
          org_id: 1,
          repo_id: 10,
          user_id: 1,
          action: 'sdk_published',
          metadata_json: {
            repository: 'offscale/cdd-ts',
            language: 'TypeScript',
            registry: 'npm',
            status: 'Success',
            durationMs: 1200,
          },
          timestamp: '2026-10-31T12:00:00Z',
        },
        {
          id: 9002,
          org_id: 1,
          repo_id: 10,
          user_id: 1,
          action: 'publish_failed',
          metadata_json: {
            repository: 'offscale/cdd-rust',
            language: 'Rust',
            registry: 'cargo',
            status: 'Failed',
            error_message: 'Registry token expired',
            durationMs: 850,
          },
          timestamp: '2026-10-31T12:05:00Z',
        },
      ]),
    });
  });

  // Mock cdd-gateway GitHub sync, workflow triggers, and secrets
  await page.route(`${MOCK_BACKEND_URL}/github/sync`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Synced 2 orgs and 5 repos' }),
    });
  });

  await page.route(`${MOCK_BACKEND_URL}/github/actions/workflows/trigger`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Workflow dispatched' }),
    });
  });

  await page.route(`${MOCK_BACKEND_URL}/github/actions/secrets`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Secret stored' }),
    });
  });

  // Mock cdd-gateway / cdd-engine JSON-RPC 2.0 and MCP endpoints
  await page.route(`${MOCK_BACKEND_URL}/rpc`, async (route) => {
    const req = route.request().postDataJSON() as { id: number; method: string };
    if (req.method === 'to_docs_json') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: req.id,
          result: { endpoints: { '/pets': { get: '// Remote RPC SDK snippet' } } },
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { gateway: '0.1.0' } }),
      });
    }
  });

  await page.route(`${MOCK_BACKEND_URL}/mcp/message`, async (route) => {
    const req = route.request().postDataJSON() as { id: number };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify([
                { path: 'remote-sdk.ts', content: 'export const sdk = true;' },
              ]),
            },
          ],
        },
      }),
    });
  });
}

/**
 * Dismisses the initial WASM preload confirmation dialog on the workspace page.
 * @param page The Playwright Page instance.
 */
async function dismissWasmDialog(page: Page): Promise<void> {
  const loadWasmBtn = page.getByRole('button', { name: /Load ~.*MB of WASM/i });
  await loadWasmBtn.waitFor({ state: 'visible' });
  await loadWasmBtn.click();
}

test.describe('Online Backend Integration, Dashboard & Accessibility E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupBackendAndWasmMocks(page);
  });

  test('Online Settings dialog: connect to cdd-gateway, probe health/versions, authenticate, and publish/delete docs on cdd-storage', async ({
    page,
  }) => {
    await page.goto('/');
    await dismissWasmDialog(page);

    // Verify WCAG AA landmarks on Workspace shell
    await expect(page.locator('mat-toolbar[role="banner"]')).toBeVisible();
    await expect(page.locator('main[role="main"]')).toBeVisible();
    await expect(page.locator('footer[role="contentinfo"]')).toBeVisible();
    await expect(page.locator('[role="toolbar"][aria-label="Workspace Tools"]')).toBeVisible();

    // Open Online Settings dialog
    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Connect to backend URL
    const backendUrlInput = dialog.locator('input[formControlName="url"]');
    await backendUrlInput.fill(MOCK_BACKEND_URL);
    await dialog.getByRole('button', { name: 'Connect', exact: true }).click();

    // Verify online status & probed gateway version
    await expect(dialog.locator('.online-status-banner')).toContainText(
      `Currently Online: ${MOCK_BACKEND_URL}`,
    );
    await expect(dialog.locator('.version-badge')).toContainText('Gateway Version: 0.1.0');

    // Register via Online Settings dialog
    await dialog.locator('input[formControlName="username"]').fill('alice@example.com');
    await dialog.locator('input[formControlName="password"]').fill('Secret123!');
    await dialog.getByRole('button', { name: 'Register' }).click();
    await expect(dialog.locator('p.success')).toContainText('Registered successfully!');

    // Close dialog
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();

    // Verify header status indicator is now online
    await expect(page.locator('[aria-label="System is online"]')).toBeVisible();

    // Verify Online Workspace toolbar actions (Release Docs -> View Docs -> Delete Docs -> Clean SDKs)
    const releaseDocsBtn = page.locator('.release-docs-btn');
    await expect(releaseDocsBtn).toBeVisible();
    await releaseDocsBtn.click();

    const viewDocsLink = page.locator('.view-docs-link');
    await expect(viewDocsLink).toBeVisible();
    await expect(viewDocsLink).toHaveAttribute(
      'href',
      `${MOCK_BACKEND_URL}/docs/?spec=${encodeURIComponent(`${MOCK_BACKEND_URL}/storage/artifact/default/workspace/latest/docs.json`)}`,
    );

    const deleteDocsBtn = page.locator('.delete-docs-btn');
    await expect(deleteDocsBtn).toBeVisible();
    await deleteDocsBtn.click();
    await expect(viewDocsLink).toBeHidden();

    // Verify keyboard accessibility on the vertical resizer separator
    const resizer = page.locator('.vertical-resizer[role="separator"]');
    await expect(resizer).toHaveAttribute('aria-orientation', 'horizontal');
    const initialHeight = Number(await resizer.getAttribute('aria-valuenow'));
    await resizer.dispatchEvent('keydown', { key: 'ArrowUp' });
    await expect(resizer).toHaveAttribute('aria-valuenow', String(initialHeight + 20));

    // Verify Docs UI preview in bottom panel NEVER takes up the whole screen or hides top panes/tabs
    await page.getByRole('tab', { name: 'Docs UI' }).click();
    await expect(page.locator('cdd-api-docs')).toBeVisible();
    const topPaneBox = await page.locator('.top-pane').boundingBox();
    const bottomPaneBox = await page.locator('.bottom-pane').boundingBox();
    const tabHeaderBox = await page.locator('.bottom-panel-tabs .mat-mdc-tab-header').boundingBox();
    expect(topPaneBox).not.toBeNull();
    expect(bottomPaneBox).not.toBeNull();
    expect(tabHeaderBox).not.toBeNull();
    expect(topPaneBox!.height).toBeGreaterThanOrEqual(200);
    expect(bottomPaneBox!.height).toBeLessThanOrEqual(500);
    expect(tabHeaderBox!.height).toBeGreaterThan(20);
  });

  test('Authentication Guard, Login Page, GitHub OAuth Callback, and Full Dashboard Lifecycle (Organizations, Repositories, Secrets, Audit Logs, Account Deletion)', async ({
    page,
  }) => {
    // 1. Verify AuthGuard redirects unauthenticated /dashboard access to /login
    await page.goto('/dashboard/organizations');
    await dismissWasmDialog(page);
    await expect(page).toHaveURL(/\/login(\?.*)?$/);

    // 2. Connect Backend Server on Login page
    const urlInput = page.locator('.backend-url-form input[formControlName="url"]');
    await urlInput.fill(MOCK_BACKEND_URL);
    await page.locator('.connect-backend-btn').click();
    await expect(page.locator('.online-pill')).toContainText(MOCK_BACKEND_URL);

    // 3. Register and sign in via Login page
    await page.locator('.toggle-mode-btn').click();
    await page.locator('input[formControlName="username"]').fill('alice');
    await page.locator('input[formControlName="email"]').fill('alice@example.com');
    await page.locator('input[formControlName="password"]').fill('Secret123!');
    await page.locator('.submit-btn').click();

    // Verify navigation to /dashboard/organizations
    await expect(page).toHaveURL(/\/dashboard\/organizations$/);
    await expect(page.locator('.backend-url-text')).toContainText(MOCK_BACKEND_URL);
    await expect(page.locator('.error-banner')).toHaveCount(0);

    // 4. Organizations Page: verify loaded orgs, sync with GitHub, create org, invite member
    await expect(page.locator('.org-card').first()).toContainText('offscale');
    await page.locator('.sync-github-btn').click();
    await expect(page.locator('.status-banner')).toContainText('Synced 2 orgs and 5 repos');
    await expect(page.locator('.error-banner')).toHaveCount(0);

    await page.getByRole('button', { name: 'Create Organization' }).click();
    await page.locator('#orgName').fill('new-cloud-org');
    await page.locator('.create-org-card button[type="submit"]').click();
    await expect(page.locator('.org-card', { hasText: 'new-cloud-org' })).toBeVisible();
    await expect(page.locator('.error-banner')).toHaveCount(0);

    // Open Invite modal and verify ARIA dialog attributes
    await page.locator('.org-card').first().getByRole('button', { name: 'Invite Users' }).click();
    const inviteDialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(inviteDialog).toBeVisible();
    await inviteDialog.locator('#email').fill('teammate@example.com');
    await inviteDialog.getByRole('button', { name: 'Send Invite' }).click();
    await expect(inviteDialog).toBeHidden();
    await expect(page.locator('.error-banner')).toHaveCount(0);

    // 5. Navigate to Repositories Page: link repository and create release
    await page.locator('.sidebar-nav a', { hasText: 'Repositories' }).click();
    await expect(page).toHaveURL(/\/dashboard\/repositories$/);
    await expect(page.locator('.error-banner')).toHaveCount(0);
    await expect(page.locator('.repo-card').first()).toContainText('offscale/cdd-ts');

    await page.getByRole('button', { name: 'Link Repository' }).click();
    await page.locator('#repoName').fill('offscale/cdd-web-ui');
    await page.locator('.create-repo-card button[type="submit"]').click();
    await expect(page.locator('.repo-card', { hasText: 'offscale/cdd-web-ui' })).toBeVisible();
    await expect(page.locator('.error-banner')).toHaveCount(0);

    // Open Create Release modal on first repository
    await page.locator('.repo-card').first().locator('.create-release-btn').click();
    const releaseDialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(releaseDialog).toBeVisible();
    await releaseDialog.locator('#releaseTag').fill('v1.2.0');
    await releaseDialog.locator('#releaseName').fill('Release v1.2.0');
    await releaseDialog.locator('button[type="submit"]').click();
    await expect(releaseDialog).toBeHidden();
    await expect(page.locator('.status-banner')).toContainText('v1.2.0');
    await expect(page.locator('.error-banner')).toHaveCount(0);

    // 6. Navigate to Secrets & Releases Page: save vault token, revoke token, trigger workflow
    await page.locator('.sidebar-nav a', { hasText: 'Secrets & Releases' }).click();
    await expect(page).toHaveURL(/\/dashboard\/secrets$/);
    await expect(page.locator('.error-banner')).toHaveCount(0);
    await expect(page.locator('.token-chip', { hasText: 'github' })).toBeVisible();

    await page.locator('#npmToken').fill('npm_secret_token_123');
    await page.getByRole('button', { name: 'Save Tokens' }).click();
    await expect(page.locator('.status-msg.success')).toContainText('Tokens saved to vault!');

    await page.getByRole('button', { name: 'Run Generation' }).click();
    await expect(page.locator('.alert.alert-success').first()).toContainText('Workflow dispatched');

    // 7. Navigate to Audit Logs Page: verify logs table and inspect error modal
    await page.locator('.sidebar-nav a', { hasText: 'Audit Logs' }).click();
    await expect(page).toHaveURL(/\/dashboard\/audit-logs$/);
    await expect(page.locator('.error-banner')).toHaveCount(0);
    await expect(page.locator('table[aria-label="Audit Logs"]')).toContainText('offscale/cdd-ts');
    await expect(page.locator('table[aria-label="Audit Logs"]')).toContainText('offscale/cdd-rust');

    await page.getByRole('button', { name: 'View Error' }).click();
    const errorDialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog.locator('.error-box')).toContainText('Registry token expired');
    await errorDialog.getByRole('button', { name: 'Close' }).click();
    await expect(errorDialog).toBeHidden();

    // 8. Delete Account and verify redirect to /login
    await page.locator('.btn-delete-account').click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('GitHub OAuth Callback (/auth-callback) exchanges code and navigates to Dashboard', async ({
    page,
  }) => {
    await page.addInitScript((url: string) => {
      localStorage.setItem('cdd_backend_url', url);
    }, MOCK_BACKEND_URL);

    await page.goto('/');
    await dismissWasmDialog(page);
    await page.evaluate(() => {
      window.history.pushState({}, '', '/auth-callback?code=oauth_code_xyz');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page).toHaveURL(/\/dashboard\/organizations$/);
    await expect(page.locator('.error-banner')).toHaveCount(0);
  });
});
