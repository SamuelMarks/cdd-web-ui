/**
 * Dashboard secrets and manual release trigger page component.
 * @module app/pages/dashboard/secrets/secrets.component
 */
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../services/auth.service';

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
 * Component to manage registry tokens and manually trigger generation or publishing tasks.
 */
@Component({
  selector: 'app-secrets',
  imports: [ReactiveFormsModule, MatButtonModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <h1 i18n="@@secretsTitle">Secrets & Releases</h1>
        <p class="subtitle" i18n="@@secretsSubtitle">
          Manage your registry tokens and manually trigger SDK releases.
        </p>
      </div>

      <div class="grid">
        <!-- Tokens Configuration -->
        <div class="card tokens-card">
          <h2 i18n="@@registryTokensHeading">Registry Tokens</h2>
          <p class="section-desc" i18n="@@registryTokensDesc">
            These tokens are securely stored in the CDD Control Plane Vault.
          </p>

          <form [formGroup]="tokensForm" (ngSubmit)="onSaveTokens()">
            <div class="form-group">
              <label for="npmToken" i18n="@@npmTokenLabel">npm Token</label>
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
              <label for="pypiToken" i18n="@@pypiTokenLabel">PyPI Token</label>
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
              <label for="cargoToken" i18n="@@cargoTokenLabel">Cargo Token (crates.io)</label>
              <input
                type="password"
                id="cargoToken"
                formControlName="cargo"
                class="form-control"
                placeholder="cio..."
                i18n-placeholder="@@cargoTokenPlaceholder"
              />
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

        <!-- Manual Actions -->
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
 * Component to manage registry tokens and manually trigger generation or publishing tasks.
 */
export class SecretsComponent {
  /** HTTP client for making API requests */
  private readonly http = inject(HttpClient);
  /** Service to manage authentication and user sessions */
  private readonly authService = inject(AuthService);

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
   * Form group for managing tokens
   */
  tokensForm = new FormGroup({
    npm: new FormControl(''),
    pypi: new FormControl(''),
    cargo: new FormControl(''),
  });

  /**
   * Handles saving the tokens to the vault
   */
  onSaveTokens(): void {
    this.tokensState.set({ status: 'loading' });

    // Fake delay
    setTimeout(() => {
      this.tokensState.set({ status: 'success' });
      this.tokensForm.markAsPristine();
      setTimeout(() => this.tokensState.set({ status: 'idle' }), 3000);
    }, 1000);
  }

  /**
   * Triggers a manual action
   * @param action The action to trigger
   */
  triggerAction(action: 'generate' | 'publish'): void {
    const state = action === 'generate' ? this.generateState : this.publishState;
    state.set({ status: 'loading' });

    // Simulating POST to trigger actions
    setTimeout(() => {
      state.set({
        status: 'success',
        message: `${action.charAt(0).toUpperCase() + action.slice(1)} completed successfully.`,
      });
      setTimeout(() => state.set({ status: 'idle' }), 5000);
    }, 1500);
  }
}
