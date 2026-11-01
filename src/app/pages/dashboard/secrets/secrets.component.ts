/**
 * Dashboard secrets, PGP signing keys, documentation hosting tokens, and manual release trigger page component.
 * @module app/pages/dashboard/secrets/secrets.component
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { forkJoin, Observable } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';
import { BackendConfigService } from '../../../services/backend-config.service';
import { TokenProvider } from '../../../models/types';

/**
 * Represents the execution state of an action or task.
 */
interface ActionState {
  /** The current status of the action */
  status: 'idle' | 'loading' | 'success' | 'error';
  /** An optional message, usually providing more details about success or error states */
  message?: string;
}

/**
 * Metadata descriptor for a supported Control Plane vault provider.
 */
export interface VaultProviderOption {
  /** Canonical provider ID (`TokenProvider`). */
  readonly id: TokenProvider;
  /** Human-readable provider label. */
  readonly label: string;
  /** Category grouping (`'vcs' | 'registry' | 'docs' | 'pgp'`). */
  readonly category: 'vcs' | 'registry' | 'docs' | 'pgp';
}

/**
 * Component to manage registry tokens, PGP signing keys, documentation tokens,
 * GitHub Actions secrets, and manually trigger generation or publishing tasks.
 */
@Component({
  selector: 'app-secrets',
  imports: [ReactiveFormsModule, MatButtonModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <h1 i18n="@@secretsTitle">Secrets &amp; Releases</h1>
        <p class="subtitle" i18n="@@secretsSubtitle">
          Manage your package registry tokens, PGP signing keys, documentation tokens, and manually
          trigger SDK releases.
        </p>
      </div>

      <div class="grid">
        <!-- Tokens & PGP Keys Configuration -->
        <div class="card tokens-card">
          <h2 i18n="@@registryTokensHeading">Registry, Docs &amp; PGP Vault</h2>
          <p class="section-desc" i18n="@@registryTokensDesc">
            Encrypted with AES-256-GCM in the CDD Control Plane Vault for automated releases across
            all 13 ecosystems.
          </p>

          @if (configuredProviders().length) {
            <div class="configured-tokens" role="region" aria-label="Configured Vault Tokens">
              <span class="configured-label" i18n="@@configuredVaultTokensLabel"
                >Active Vault Secrets:</span
              >
              @for (prov of configuredProviders(); track prov) {
                <span class="token-chip">
                  {{ prov }}
                  <button
                    type="button"
                    class="revoke-btn"
                    [attr.aria-label]="'Revoke ' + prov + ' token'"
                    (click)="onDeleteToken(prov)"
                  >
                    &times;
                  </button>
                </span>
              }
            </div>
          }

          <form [formGroup]="tokensForm" (ngSubmit)="onSaveTokens()">
            <div class="form-group">
              <label for="githubToken" i18n="@@githubTokenLabel"
                >GitHub Token (GitHub Releases / Packages / Pages)</label
              >
              <input
                type="password"
                id="githubToken"
                formControlName="github"
                class="form-control"
                placeholder="ghp_..."
                i18n-placeholder="@@githubTokenPlaceholder"
              />
            </div>

            <div class="form-group">
              <label for="npmToken" i18n="@@npmTokenLabel">npm Token (TypeScript / JS)</label>
              <input
                type="password"
                id="npmToken"
                formControlName="npm"
                class="form-control"
                placeholder="npm_..."
                i18n-placeholder="@@npmTokenPlaceholder"
              />
            </div>

            <div class="form-group">
              <label for="pypiToken" i18n="@@pypiTokenLabel">PyPI Token (Python)</label>
              <input
                type="password"
                id="pypiToken"
                formControlName="pypi"
                class="form-control"
                placeholder="pypi-..."
                i18n-placeholder="@@pypiTokenPlaceholder"
              />
            </div>

            <div class="form-group">
              <label for="cargoToken" i18n="@@cargoTokenLabel">Cargo Token (Rust crates.io)</label>
              <input
                type="password"
                id="cargoToken"
                formControlName="cargo"
                class="form-control"
                placeholder="cio..."
                i18n-placeholder="@@cargoTokenPlaceholder"
              />
            </div>

            <div class="form-group">
              <label for="additionalProviderSelect" i18n="@@additionalProviderLabel">
                Additional App Store / Registry / Docs / PGP Provider
              </label>
              <select
                id="additionalProviderSelect"
                formControlName="additionalProvider"
                class="form-control"
              >
                @for (opt of additionalProviderOptions; track opt.id) {
                  <option [value]="opt.id">{{ opt.label }} ({{ opt.id }})</option>
                }
              </select>
            </div>

            <div class="form-group">
              <label for="additionalTokenInput" i18n="@@additionalTokenInputLabel">
                Secret Token or ASCII-Armored PGP Key
              </label>
              <textarea
                id="additionalTokenInput"
                formControlName="additionalToken"
                class="form-control"
                rows="2"
                placeholder="Paste registry token, Read the Docs token, or -----BEGIN PGP PRIVATE KEY BLOCK-----"
              ></textarea>
            </div>

            <div class="form-actions">
              <button
                type="submit"
                mat-flat-button
                class="btn btn-primary"
                [disabled]="tokensForm.pristine || tokensState().status === 'loading'"
              >
                @if (tokensState().status === 'loading') {
                  <span i18n="@@savingTokensBtn">Saving...</span>
                } @else {
                  <span i18n="@@saveTokensBtn">Save Tokens</span>
                }
              </button>

              @if (tokensState().status === 'success') {
                <span
                  class="status-msg success"
                  role="status"
                  aria-live="polite"
                  i18n="@@tokensSavedMsg"
                  >Tokens saved to vault!</span
                >
              }
              @if (tokensState().status === 'error') {
                <span class="status-msg error" role="alert">{{ tokensState().message }}</span>
              }
            </div>
          </form>
        </div>

        <!-- Manual Actions & GitHub Secrets -->
        <div class="card actions-card">
          <h2 i18n="@@manualTriggersHeading">Manual Triggers</h2>
          <p class="section-desc" i18n="@@manualTriggersDesc">
            Manually initiate generation or publishing for linked repositories.
          </p>

          <div class="action-item">
            <div class="action-info">
              <h3 i18n="@@generateSdksHeading">Generate SDKs</h3>
              <p i18n="@@generateSdksDesc">
                Re-generates SDK source code based on the latest OpenAPI schemas.
              </p>
            </div>
            <button
              type="button"
              mat-stroked-button
              class="btn btn-secondary"
              (click)="triggerAction('generate')"
              [disabled]="generateState().status === 'loading'"
            >
              @if (generateState().status === 'loading') {
                <span i18n="@@runningGenerateBtn">Running...</span>
              } @else {
                <span i18n="@@runGenerationBtn">Run Generation</span>
              }
            </button>
          </div>
          @if (generateState().message) {
            <div
              class="alert"
              role="status"
              aria-live="polite"
              [class.alert-success]="generateState().status === 'success'"
              [class.alert-error]="generateState().status === 'error'"
            >
              {{ generateState().message }}
            </div>
          }

          <hr class="divider" />

          <div class="action-item">
            <div class="action-info">
              <h3 i18n="@@publishSdksHeading">Publish SDKs</h3>
              <p i18n="@@publishSdksDesc">
                Publishes generated SDKs to configured package registries.
              </p>
            </div>
            <button
              type="button"
              mat-stroked-button
              class="btn btn-secondary"
              (click)="triggerAction('publish')"
              [disabled]="publishState().status === 'loading'"
            >
              @if (publishState().status === 'loading') {
                <span i18n="@@runningPublishBtn">Running...</span>
              } @else {
                <span i18n="@@runPublishingBtn">Run Publishing</span>
              }
            </button>
          </div>
          @if (publishState().message) {
            <div
              class="alert"
              role="status"
              aria-live="polite"
              [class.alert-success]="publishState().status === 'success'"
              [class.alert-error]="publishState().status === 'error'"
            >
              {{ publishState().message }}
            </div>
          }

          <hr class="divider" />

          <h3 i18n="@@githubActionsSecretsHeading">Push Secret to GitHub Actions</h3>
          <form [formGroup]="githubSecretForm" (ngSubmit)="onUploadGithubSecret()">
            <div class="form-group">
              <label for="ghSecretOwner" i18n="@@ghSecretOwnerLabel">Owner</label>
              <input
                type="text"
                id="ghSecretOwner"
                formControlName="owner"
                class="form-control"
                placeholder="offscale"
              />
            </div>
            <div class="form-group">
              <label for="ghSecretRepo" i18n="@@ghSecretRepoLabel">Repository</label>
              <input
                type="text"
                id="ghSecretRepo"
                formControlName="repo"
                class="form-control"
                placeholder="cdd-ctl"
              />
            </div>
            <div class="form-group">
              <label for="ghSecretName" i18n="@@ghSecretNameLabel">Secret Name</label>
              <input
                type="text"
                id="ghSecretName"
                formControlName="secret_name"
                class="form-control"
                placeholder="NPM_TOKEN"
              />
            </div>
            <div class="form-group">
              <label for="ghSecretVal" i18n="@@ghSecretValLabel">Secret Value</label>
              <input
                type="password"
                id="ghSecretVal"
                formControlName="secret_value"
                class="form-control"
                placeholder="secret..."
              />
            </div>
            <button
              type="submit"
              mat-stroked-button
              class="btn btn-secondary"
              [disabled]="githubSecretForm.invalid"
              i18n="@@pushGithubSecretBtn"
            >
              Push GitHub Secret
            </button>
            @if (githubSecretState().message) {
              <div
                class="alert"
                role="status"
                aria-live="polite"
                [class.alert-success]="githubSecretState().status === 'success'"
                [class.alert-error]="githubSecretState().status === 'error'"
              >
                {{ githubSecretState().message }}
              </div>
            }
          </form>
        </div>
      </div>
    </div>
  `,
  styles: `
    .page-container {
      max-width: 1000px;
      margin: 0 auto;
    }
    .header-actions {
      margin-bottom: 2rem;
      h1 {
        margin: 0 0 0.5rem 0;
        color: var(--text-primary);
      }
      .subtitle {
        margin: 0;
        color: var(--text-secondary);
        font-size: 1rem;
      }
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
      @media (min-width: 768px) {
        grid-template-columns: 1fr 1fr;
      }
    }
    .card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1.5rem;
      h2 {
        margin: 0 0 0.5rem 0;
        font-size: 1.25rem;
      }
    }
    .section-desc {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .configured-tokens {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .configured-label {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      font-weight: 500;
    }
    .token-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: var(--primary-hover);
      color: var(--primary-color);
      padding: 0.2rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .revoke-btn {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      font-size: 0.875rem;
      line-height: 1;
      padding: 0 2px;
    }
    .form-group {
      margin-bottom: 1.25rem;
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--text-primary);
        font-size: 0.875rem;
      }
    }
    .form-control {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 0.875rem;
      box-sizing: border-box;
      font-family: monospace;
      background-color: var(--surface-color);
      color: var(--text-primary);
      &:focus {
        outline: 2px solid var(--primary-color);
        outline-offset: 1px;
        border-color: var(--primary-color);
      }
    }
    .form-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 2rem;
    }
    .status-msg {
      font-size: 0.875rem;
      font-weight: 500;
      &.success {
        color: var(--success-text);
      }
      &.error {
        color: var(--error-text);
      }
    }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      font-size: 0.875rem;
    }
    .btn-primary {
      background-color: var(--primary-color);
      color: var(--mat-sys-on-primary, #ffffff);
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    .btn-secondary {
      background-color: var(--bg-color);
      color: var(--text-primary);
      border-color: var(--border-color);
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    .action-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 1.5rem 0 1rem;
    }
    .action-info {
      h3 {
        margin: 0 0 0.25rem 0;
        font-size: 1rem;
      }
      p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
      }
    }
    .divider {
      border: 0;
      border-top: 1px solid var(--border-color);
      margin: 1.5rem 0;
    }
    .alert {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    .alert-success {
      background: var(--primary-hover);
      color: var(--mat-sys-on-primary-container, var(--primary-color));
      border: 1px solid var(--primary-color);
    }
    .alert-error {
      background: var(--error-bg);
      color: var(--error-text);
      border: 1px solid var(--error-text);
    }
  `,
})
/**
 * Component to manage registry tokens, PGP keys, documentation tokens, and manually trigger generation or publishing tasks.
 */
export class SecretsComponent implements OnInit {
  /** Service to manage authentication and user sessions */
  private readonly authService = inject(AuthService);
  /** Backend API service */
  private readonly api = inject(ApiService);
  /** Backend configuration service */
  private readonly config = inject(BackendConfigService);

  /** Providers that currently have encrypted tokens stored in the Control Plane vault. */
  readonly configuredProviders = signal<TokenProvider[]>([]);

  /** Supported additional vault providers across all 13 language ecosystems, docs hosts, and PGP signing. */
  readonly additionalProviderOptions: readonly VaultProviderOption[] = [
    { id: 'maven', label: 'Maven Central (Java / Kotlin)', category: 'registry' },
    { id: 'nuget', label: 'NuGet Gallery (C# / .NET)', category: 'registry' },
    { id: 'rubygems', label: 'RubyGems.org (Ruby)', category: 'registry' },
    { id: 'packagist', label: 'Packagist (PHP)', category: 'registry' },
    { id: 'conan', label: 'Conan Center (C / C++)', category: 'registry' },
    { id: 'vcpkg', label: 'vcpkg Registry (C / C++)', category: 'registry' },
    { id: 'homebrew', label: 'Homebrew Tap (CLI / Shell / Swift)', category: 'registry' },
    { id: 'readthedocs', label: 'Read the Docs API Token', category: 'docs' },
    { id: 'pgp_private_key', label: 'PGP Signing Private Key (ASCII-Armored)', category: 'pgp' },
    { id: 'pgp_passphrase', label: 'PGP Key Passphrase', category: 'pgp' },
    { id: 'gitlab', label: 'GitLab Personal Access Token', category: 'vcs' },
    { id: 'bitbucket', label: 'Bitbucket App Password', category: 'vcs' },
  ];

  /**
   * State of the save tokens action
   */
  tokensState = signal<ActionState>({ status: 'idle' });
  /**
   * State of the generate action
   */
  generateState = signal<ActionState>({ status: 'idle' });
  /**
   * State of the publish action
   */
  publishState = signal<ActionState>({ status: 'idle' });
  /**
   * State of the GitHub Actions secret push action
   */
  githubSecretState = signal<ActionState>({ status: 'idle' });

  /**
   * Form group for registry, documentation, and PGP vault secrets
   */
  tokensForm = new FormGroup({
    github: new FormControl(''),
    npm: new FormControl(''),
    pypi: new FormControl(''),
    cargo: new FormControl(''),
    additionalProvider: new FormControl<TokenProvider>('pgp_private_key'),
    additionalToken: new FormControl(''),
  });

  /**
   * Form group for pushing a GitHub Actions secret
   */
  githubSecretForm = new FormGroup({
    owner: new FormControl('', Validators.required),
    repo: new FormControl('', Validators.required),
    secret_name: new FormControl('', Validators.required),
    secret_value: new FormControl('', Validators.required),
  });

  /**
   * Initializes the component and fetches configured vault token providers when online.
   */
  ngOnInit(): void {
    if (this.config.isOnline()) {
      this.loadVaultTokens();
    }
  }

  /**
   * Queries `GET /api/v1/tokens` for stored token providers.
   */
  loadVaultTokens(): void {
    this.api.listTokens().subscribe({
      next: (providers) => {
        this.configuredProviders.set(providers);
      },
      error: () => {
        // Ignore error if unauthenticated
      },
    });
  }

  /**
   * Handles saving the registry tokens and PGP keys to the Control Plane vault (`POST /api/v1/tokens`).
   */
  onSaveTokens(): void {
    this.tokensState.set({ status: 'loading' });

    if (this.config.isOnline()) {
      const raw = this.tokensForm.getRawValue();
      const primaryProviders: ('github' | 'npm' | 'pypi' | 'cargo')[] = [
        'github',
        'npm',
        'pypi',
        'cargo',
      ];
      const calls: Observable<{
        /** Status string returned by the control plane. */
        status: string;
      }>[] = [];

      for (const provider of primaryProviders) {
        const val = raw[provider]?.trim();
        if (val) {
          calls.push(this.api.storeToken({ provider, token: val }));
        }
      }

      const extraProvider = raw.additionalProvider;
      const extraVal = raw.additionalToken?.trim();
      if (extraProvider && extraVal) {
        calls.push(this.api.storeToken({ provider: extraProvider, token: extraVal }));
      }

      if (calls.length === 0) {
        this.tokensState.set({ status: 'success' });
        this.tokensForm.markAsPristine();
        return;
      }

      forkJoin(calls).subscribe({
        next: () => {
          this.tokensState.set({ status: 'success' });
          this.tokensForm.markAsPristine();
          this.loadVaultTokens();
        },
        error: () => {
          this.tokensState.set({
            status: 'error',
            message: 'Failed to store tokens in Control Plane vault.',
          });
        },
      });
      return;
    }

    setTimeout(() => {
      this.tokensState.set({ status: 'success' });
      this.tokensForm.markAsPristine();

      setTimeout(() => {
        this.tokensState.set({ status: 'idle' });
      }, 3000);
    }, 1000);
  }

  /**
   * Deletes/revokes a stored token for the specified provider (`DELETE /api/v1/tokens/{provider}`).
   * @param provider The provider whose token should be deleted.
   */
  onDeleteToken(provider: TokenProvider): void {
    if (this.config.isOnline()) {
      this.api.deleteToken(provider).subscribe({
        next: () => {
          this.configuredProviders.update((list) => list.filter((p) => p !== provider));
        },
        error: () => {
          this.tokensState.set({
            status: 'error',
            message: `Failed to revoke ${provider} token.`,
          });
        },
      });
      return;
    }
    this.configuredProviders.update((list) => list.filter((p) => p !== provider));
  }

  /**
   * Uploads a secret to a GitHub repository's Actions secrets (`POST /github/actions/secrets`).
   */
  onUploadGithubSecret(): void {
    if (this.githubSecretForm.invalid) {
      return;
    }
    const val = this.githubSecretForm.getRawValue();
    const payload = {
      owner: val.owner || '',
      repo: val.repo || '',
      secret_name: val.secret_name || '',
      secret_value: val.secret_value || '',
    };

    if (this.config.isOnline()) {
      this.githubSecretState.set({ status: 'loading' });
      this.api.createGithubSecret(payload).subscribe({
        next: (res) => {
          this.githubSecretState.set({
            status: 'success',
            message: res.message || 'GitHub Actions secret saved.',
          });
          this.githubSecretForm.reset();
        },
        error: () => {
          this.githubSecretState.set({
            status: 'error',
            message: 'Failed to push GitHub Actions secret.',
          });
        },
      });
      return;
    }

    this.githubSecretState.set({
      status: 'success',
      message: 'GitHub Actions secret queued (Offline Mode).',
    });
  }

  /**
   * Triggers a manual action (generate or publish)
   * @param action The type of action to trigger
   */
  triggerAction(action: 'generate' | 'publish'): void {
    const state = action === 'generate' ? this.generateState : this.publishState;
    state.set({ status: 'loading', message: undefined });

    if (this.config.isOnline()) {
      if (action === 'generate') {
        this.api
          .triggerGithubWorkflow({
            owner: 'offscale',
            repo: 'cdd-ctl',
            workflow_id: 'sdk-generate.yml',
            ref_branch: 'main',
          })
          .subscribe({
            next: (res) => {
              state.set({
                status: 'success',
                message: res.message || 'Generate completed successfully.',
              });
            },
            error: () => {
              state.set({
                status: 'error',
                message: 'Failed to trigger remote SDK generation.',
              });
            },
          });
      } else {
        this.api
          .createOrgRelease(1, 1, {
            tag_name: 'v1.0.0',
            name: 'Manual SDK Release',
            body: 'Triggered from CDD Web UI',
          })
          .subscribe({
            next: (rel) => {
              state.set({
                status: 'success',
                message: `Publish queued for release ${rel.tag_name}.`,
              });
            },
            error: () => {
              state.set({
                status: 'error',
                message: 'Failed to enqueue SDK publishing job.',
              });
            },
          });
      }
      return;
    }

    setTimeout(() => {
      state.set({
        status: 'success',
        message: `${action.charAt(0).toUpperCase() + action.slice(1)} completed successfully.`,
      });
      setTimeout(() => state.set({ status: 'idle' }), 5000);
    }, 1500);
  }
}
