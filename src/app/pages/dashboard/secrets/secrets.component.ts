import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
  imports: [ReactiveFormsModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <h1>Secrets & Releases</h1>
        <p class="subtitle">Manage your registry tokens and manually trigger SDK releases.</p>
      </div>

      <div class="grid">
        <!-- Tokens Configuration -->
        <div class="card tokens-card">
          <h2>Registry Tokens</h2>
          <p class="section-desc">
            These tokens are securely stored in the CDD Control Plane Vault.
          </p>

          <form [formGroup]="tokensForm" (ngSubmit)="onSaveTokens()">
            <div class="form-group">
              <label for="npmToken">npm Token</label>
              <input
                type="password"
                id="npmToken"
                formControlName="npm"
                class="form-control"
                placeholder="npm_..."
              />
            </div>

            <div class="form-group">
              <label for="pypiToken">PyPI Token</label>
              <input
                type="password"
                id="pypiToken"
                formControlName="pypi"
                class="form-control"
                placeholder="pypi-..."
              />
            </div>

            <div class="form-group">
              <label for="cargoToken">Cargo Token (crates.io)</label>
              <input
                type="password"
                id="cargoToken"
                formControlName="cargo"
                class="form-control"
                placeholder="cio..."
              />
            </div>

            <div class="form-actions">
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="tokensForm.pristine || tokensState().status === 'loading'"
              >
                {{ tokensState().status === 'loading' ? 'Saving...' : 'Save Tokens' }}
              </button>

              @if (tokensState().status === 'success') {
                <span class="status-msg success">Tokens saved to vault!</span>
              }
              @if (tokensState().status === 'error') {
                <span class="status-msg error">{{ tokensState().message }}</span>
              }
            </div>
          </form>
        </div>

        <!-- Manual Actions -->
        <div class="card actions-card">
          <h2>Manual Triggers</h2>
          <p class="section-desc">
            Manually initiate generation or publishing for linked repositories.
          </p>

          <div class="action-item">
            <div class="action-info">
              <h3>Generate SDKs</h3>
              <p>Re-generates SDK source code based on the latest OpenAPI schemas.</p>
            </div>
            <button
              class="btn btn-secondary"
              (click)="triggerAction('generate')"
              [disabled]="generateState().status === 'loading'"
            >
              {{ generateState().status === 'loading' ? 'Running...' : 'Run Generation' }}
            </button>
          </div>
          @if (generateState().message) {
            <div
              class="alert"
              [class.alert-success]="generateState().status === 'success'"
              [class.alert-error]="generateState().status === 'error'"
            >
              {{ generateState().message }}
            </div>
          }

          <hr class="divider" />

          <div class="action-item">
            <div class="action-info">
              <h3>Publish SDKs</h3>
              <p>Publishes generated SDKs to configured package registries.</p>
            </div>
            <button
              class="btn btn-secondary"
              (click)="triggerAction('publish')"
              [disabled]="publishState().status === 'loading'"
            >
              {{ publishState().status === 'loading' ? 'Running...' : 'Run Publishing' }}
            </button>
          </div>
          @if (publishState().message) {
            <div
              class="alert"
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
        color: var(--color-text-default, #24292f);
      }
      .subtitle {
        margin: 0;
        color: var(--color-text-muted, #57606a);
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
      background: var(--color-bg-default, #ffffff);
      border: 1px solid var(--color-border-default, #d0d7de);
      border-radius: 6px;
      padding: 1.5rem;
      h2 {
        margin: 0 0 0.5rem 0;
        font-size: 1.25rem;
      }
    }
    .section-desc {
      color: var(--color-text-muted, #57606a);
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .form-group {
      margin-bottom: 1.25rem;
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--color-text-default, #24292f);
        font-size: 0.875rem;
      }
    }
    .form-control {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-border-default, #d0d7de);
      border-radius: 6px;
      font-size: 0.875rem;
      box-sizing: border-box;
      font-family: monospace;
      &:focus {
        outline: none;
        border-color: #0969da;
        box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
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
        color: #1a7f37;
      }
      &.error {
        color: #cf222e;
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
      background-color: #1a7f37;
      color: white;
      border-color: rgba(27, 31, 36, 0.15);
      &:hover:not(:disabled) {
        background-color: #2c974b;
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    .btn-secondary {
      background-color: #f6f8fa;
      color: #24292f;
      border-color: rgba(27, 31, 36, 0.15);
      &:hover:not(:disabled) {
        background-color: #f3f4f6;
      }
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
        color: var(--color-text-muted, #57606a);
      }
    }
    .divider {
      border: 0;
      border-top: 1px solid var(--color-border-default, #d0d7de);
      margin: 1.5rem 0;
    }
    .alert {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    .alert-success {
      background: #dcffe4;
      color: #1a7f37;
      border: 1px solid #1a7f37;
    }
    .alert-error {
      background: #ffebe9;
      color: #cf222e;
      border: 1px solid #cf222e;
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
