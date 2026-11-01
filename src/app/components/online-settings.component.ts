/**
 * Dialog component for configuring online/offline execution mode and backend authentication.
 * @module app/components/online-settings.component
 */
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../services/auth.service';
import { BackendConfigService } from '../services/backend-config.service';
import { AuthMethod, OAuthProvider, PingFailureError, RunMode } from '../models/types';
import { ApiService } from '../services/api.service';
import { LoggingService } from '../services/logging.service';

/**
 * Dialog for configuring online mode, backend server URL, service endpoint overrides,
 * and authentication.
 */
@Component({
  selector: 'app-online-settings',
  /** imports */
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
  ],
  /** template */
  template: `
    <h2 mat-dialog-title id="dialog-title" i18n="@@onlineSettingsTitle">Online Mode Settings</h2>
    <mat-dialog-content>
      <div class="run-mode-section">
        <h3 id="run-mode-heading" i18n="@@runModeHeading">Execution Mode</h3>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label i18n="@@runModeLabel">Select how code is generated</mat-label>
          <mat-select
            [value]="config.runMode()"
            (selectionChange)="onRunModeChange($event.value)"
            aria-labelledby="run-mode-heading"
          >
            <mat-option value="local_relative" i18n="@@runModeLocalRelative"
              >Locally (relative paths to wasm)</mat-option
            >
            <mat-option value="local_cdd_ctl_wasm" i18n="@@runModeLocalWasm"
              >Locally (cdd-engine wasm)</mat-option
            >
            <mat-option value="local_cdd_ctl_native" i18n="@@runModeLocalNative"
              >Locally (cdd-engine native runtimes)</mat-option
            >
            <mat-option value="served_github" i18n="@@runModeServedGithub"
              >Served (GitHub releases)</mat-option
            >
          </mat-select>
        </mat-form-field>
      </div>

      @if (config.isOnline() && !showEditUrl()) {
        <div class="online-status-banner">
          <p i18n="@@currentlyOnline">Currently Online: {{ config.backendUrl() }}</p>
          @if (config.gatewayVersion()) {
            <p class="version-badge" i18n="@@gatewayVersionBadge">
              Gateway Version: {{ config.gatewayVersion() }}
            </p>
          }
          <div class="actions">
            <button
              mat-stroked-button
              type="button"
              class="ping-btn"
              (click)="onPingBackend()"
              i18n="@@pingBackendBtn"
            >
              Ping
            </button>
            <button
              mat-stroked-button
              type="button"
              class="change-url-btn"
              (click)="toggleEditUrl()"
              i18n="@@changeBackendUrlBtn"
            >
              Change URL
            </button>
            <button
              mat-flat-button
              color="warn"
              type="button"
              (click)="goOffline()"
              i18n="@@goOffline"
            >
              Go Offline
            </button>
          </div>
        </div>
      } @else {
        <form
          [formGroup]="urlForm"
          (ngSubmit)="onSetUrl()"
          class="url-form"
          aria-labelledby="dialog-title"
        >
          <mat-form-field appearance="outline" class="full-width">
            <mat-label i18n="@@backendUrlLabel">Backend URL</mat-label>
            <input
              matInput
              formControlName="url"
              placeholder="http://localhost:8086"
              i18n-placeholder="@@backendUrlPlaceholder"
            />
            @if (urlForm.get('url')?.hasError('required')) {
              <mat-error i18n="@@urlRequiredError">URL is required</mat-error>
            }
          </mat-form-field>
          <div class="preset-chips" role="group" aria-label="Backend URL presets">
            <button
              type="button"
              class="preset-chip"
              (click)="selectPresetUrl('http://localhost:8086')"
            >
              Gateway (:8086)
            </button>
            <button
              type="button"
              class="preset-chip"
              (click)="selectPresetUrl('http://localhost:8081')"
            >
              Control Plane (:8081)
            </button>
            <button
              type="button"
              class="preset-chip"
              (click)="selectPresetUrl('http://localhost:8080')"
            >
              Proxy (:8080)
            </button>
          </div>
          <div class="actions">
            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="urlForm.invalid"
              i18n="@@connectBtn"
            >
              Connect
            </button>
            @if (config.isOnline()) {
              <button mat-button type="button" (click)="toggleEditUrl()" i18n="@@cancelUrlEditBtn">
                Cancel
              </button>
            }
          </div>
        </form>
      }

      <div class="advanced-section">
        <button
          mat-button
          type="button"
          class="advanced-toggle-btn"
          (click)="toggleAdvanced()"
          [attr.aria-expanded]="showAdvanced()"
          i18n="@@advancedEndpointsToggle"
        >
          Advanced Service Endpoints
        </button>
        @if (showAdvanced()) {
          <form
            [formGroup]="overridesForm"
            (ngSubmit)="onSaveOverrides()"
            class="overrides-form"
            aria-label="Advanced Service Endpoints"
          >
            <mat-form-field appearance="outline" class="full-width">
              <mat-label i18n="@@controlPlaneUrlOverrideLabel"
                >Control Plane URL Override</mat-label
              >
              <input
                matInput
                formControlName="controlPlaneUrl"
                placeholder="http://localhost:8081/api/v1"
              />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label i18n="@@storageUrlOverrideLabel">Artifact Storage URL Override</mat-label>
              <input matInput formControlName="storageUrl" placeholder="http://localhost:8085" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label i18n="@@docsUiUrlOverrideLabel">Docs UI URL Override</mat-label>
              <input matInput formControlName="docsUiUrl" placeholder="http://localhost:8082" />
            </mat-form-field>
            <button mat-stroked-button color="primary" type="submit" i18n="@@saveOverridesBtn">
              Save Endpoint Overrides
            </button>
          </form>
        }
      </div>

      @if (config.isOnline()) {
        <div class="auth-section">
          <h3 id="auth-heading" i18n="@@authHeading">Authentication</h3>
          <form
            [formGroup]="authForm"
            (ngSubmit)="onLogin()"
            class="auth-form"
            aria-labelledby="auth-heading"
          >
            <mat-form-field appearance="outline" class="full-width">
              <mat-label i18n="@@usernameLabel">Username</mat-label>
              <input matInput formControlName="username" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label i18n="@@passwordLabel">Password</mat-label>
              <input matInput type="password" formControlName="password" />
            </mat-form-field>
            <div class="actions">
              <button
                mat-stroked-button
                color="primary"
                type="submit"
                [disabled]="authForm.invalid"
                i18n="@@loginBtn"
              >
                Login
              </button>
              <button
                mat-stroked-button
                color="accent"
                type="button"
                (click)="onRegister()"
                [disabled]="authForm.invalid"
                i18n="@@registerBtn"
              >
                Register
              </button>
            </div>
          </form>

          <div class="oauth-section">
            <div class="divider">
              <span i18n="@@orDivider">OR</span>
            </div>
            <div class="oauth-btn-stack">
              <button
                mat-flat-button
                type="button"
                class="github-btn full-width"
                (click)="onGithubLogin()"
              >
                <mat-icon class="github-icon" aria-hidden="true">code</mat-icon>
                <span i18n="@@loginWithGithubBtn">Login with GitHub</span>
              </button>
              <button
                mat-stroked-button
                type="button"
                class="google-btn full-width"
                (click)="onGoogleLogin()"
              >
                <mat-icon class="github-icon" aria-hidden="true">public</mat-icon>
                <span i18n="@@loginWithGoogleBtn">Login with Google</span>
              </button>
            </div>
          </div>

          @if (authService.isAuthenticated()) {
            <div class="connected-accounts-section" aria-label="Connected Accounts">
              <h4 i18n="@@connectedAccountsHeading">Connected Accounts</h4>
              <div class="connected-row">
                <span
                  >GitHub:
                  {{ authService.connectedAccounts().github ? 'Connected' : 'Not Linked' }}</span
                >
                @if (authService.connectedAccounts().github) {
                  <button
                    mat-button
                    color="warn"
                    type="button"
                    class="disconnect-github-btn"
                    (click)="onDisconnectAccount('github')"
                  >
                    Disconnect
                  </button>
                } @else {
                  <button
                    mat-stroked-button
                    type="button"
                    class="connect-github-btn"
                    (click)="onConnectAccount('github')"
                  >
                    Connect GitHub
                  </button>
                }
              </div>
              <div class="connected-row">
                <span
                  >Google:
                  {{ authService.connectedAccounts().google ? 'Connected' : 'Not Linked' }}</span
                >
                @if (authService.connectedAccounts().google) {
                  <button
                    mat-button
                    color="warn"
                    type="button"
                    class="disconnect-google-btn"
                    (click)="onDisconnectAccount('google')"
                  >
                    Disconnect
                  </button>
                } @else {
                  <button
                    mat-stroked-button
                    type="button"
                    class="connect-google-btn"
                    (click)="onConnectAccount('google')"
                  >
                    Connect Google
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }

      @if (errorMsg()) {
        <p class="error" role="alert" aria-live="assertive">{{ errorMsg() }}</p>
      }
      @if (pingLog().length > 0) {
        <pre class="ping-log" role="log" aria-label="Ping failure diagnostic log">{{
          pingLog().join(
            '
'
          )
        }}</pre>
      }
      @if (successMsg()) {
        <p class="success" role="status" aria-live="polite">{{ successMsg() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close i18n="@@closeBtn">Close</button>
    </mat-dialog-actions>
  `,
  /** styles */
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .run-mode-section {
        margin-bottom: 1.5rem;
      }
      .preset-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .preset-chip {
        background: var(--bg-color, #f1f3f4);
        color: var(--text-primary, #202124);
        border: 1px solid var(--border-color, #dadce0);
        border-radius: 16px;
        padding: 0.25rem 0.75rem;
        font-size: 0.75rem;
        cursor: pointer;
      }
      .preset-chip:hover {
        background: var(--primary-hover, #e8f0fe);
      }
      .version-badge {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        margin-top: 0.25rem;
      }
      .advanced-section {
        margin-top: 1rem;
      }
      .overrides-form {
        margin-top: 0.75rem;
      }
      .auth-section {
        margin-top: 1.5rem;
        border-top: 1px solid var(--border-color, #ccc);
        padding-top: 1rem;
      }
      .actions {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .error {
        color: var(--error-text);
      }
      .ping-log {
        background: var(--bg-color, #1e1e1e);
        color: var(--error-text, #d93025);
        border: 1px solid var(--border-color, #dadce0);
        border-radius: 4px;
        padding: 0.5rem 0.75rem;
        font-family: monospace;
        font-size: 0.75rem;
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0.5rem 0;
      }
      .success {
        color: var(--success-text);
      }
      .oauth-section {
        margin-top: 1.5rem;
        margin-bottom: 1rem;
      }
      .divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin: 1rem 0;
        color: var(--text-secondary);
      }
      .divider::before,
      .divider::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid var(--border-color);
      }
      .divider span {
        padding: 0 10px;
        font-size: 0.875rem;
        font-weight: 500;
      }
      .oauth-btn-stack {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .github-btn,
      .google-btn {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .github-icon {
        margin-right: 8px;
        font-size: 1.25rem;
        height: 1.25rem;
        width: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .connected-accounts-section {
        margin-top: 1rem;
        padding-top: 0.75rem;
        border-top: 1px dashed var(--border-color, #ccc);
      }
      .connected-accounts-section h4 {
        margin: 0 0 0.5rem;
        font-size: 0.875rem;
      }
      .connected-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        font-size: 0.8125rem;
      }
    `,
  ],
})
/**
 * Component providing an interactive dialog to configure online backend URLs
 * and handle authentication with the remote service.
 */
export class OnlineSettingsComponent {
  /** Authentication service for user session and account linking. */
  readonly authService = inject(AuthService);
  /** Access to backend config state. */
  readonly config = inject(BackendConfigService);
  /** Form builder instance for reactive forms. */
  private readonly fb = inject(FormBuilder);
  /** Reference to the dialog instance. */
  private readonly dialogRef = inject(MatDialogRef<OnlineSettingsComponent>);
  /** API service for backend communication. */
  private readonly api = inject(ApiService);
  /** Application logging service for recording ping results and diagnostic failure logs. */
  private readonly logger = inject(LoggingService);

  /** Signal for error message. */
  readonly errorMsg = signal<string>('');
  /** Signal for success message. */
  readonly successMsg = signal<string>('');
  /** Signal holding diagnostic log lines when a backend ping fails. */
  readonly pingLog = signal<string[]>([]);
  /** Signal tracking whether the URL editor is open while online. */
  readonly showEditUrl = signal<boolean>(false);
  /** Signal tracking whether the advanced service endpoint overrides section is expanded. */
  readonly showAdvanced = signal<boolean>(false);

  /** Form for setting backend URL. */
  urlForm = this.fb.group({
    /** url */
    url: [this.config.backendUrl() || '', Validators.required],
  });

  /** Form for optional per-service endpoint URL overrides. */
  overridesForm = this.fb.group({
    /** controlPlaneUrl */
    controlPlaneUrl: [this.config.serviceOverrides().controlPlaneUrl || ''],
    /** storageUrl */
    storageUrl: [this.config.serviceOverrides().storageUrl || ''],
    /** docsUiUrl */
    docsUiUrl: [this.config.serviceOverrides().docsUiUrl || ''],
  });

  /** Form for authentication. */
  authForm = this.fb.group({
    /** username */
    username: ['', Validators.required],
    /** password */
    password: ['', Validators.required],
  });

  /**
   * Changes the run mode.
   * @param mode The selected execution run mode.
   */
  onRunModeChange(mode: RunMode): void {
    this.config.setRunMode(mode);
    this.successMsg.set('Execution mode updated.');
    this.errorMsg.set('');
  }

  /**
   * Populates the URL form with a preset local development endpoint.
   * @param presetUrl The preset URL string to populate.
   */
  selectPresetUrl(presetUrl: string): void {
    this.urlForm.patchValue({ url: presetUrl });
  }

  /**
   * Toggles the URL edit form when already connected.
   */
  toggleEditUrl(): void {
    this.showEditUrl.update((v) => !v);
    if (this.showEditUrl()) {
      this.urlForm.patchValue({ url: this.config.backendUrl() || '' });
    }
  }

  /**
   * Toggles the expandable advanced service endpoint overrides panel.
   */
  toggleAdvanced(): void {
    this.showAdvanced.update((v) => !v);
  }

  /**
   * Saves optional per-service endpoint URL overrides (`controlPlaneUrl`, `storageUrl`, `docsUiUrl`).
   */
  onSaveOverrides(): void {
    try {
      const val = this.overridesForm.getRawValue();
      this.config.setServiceOverrides({
        controlPlaneUrl: val.controlPlaneUrl || null,
        storageUrl: val.storageUrl || null,
        docsUiUrl: val.docsUiUrl || null,
      });
      this.errorMsg.set('');
      this.successMsg.set('Service endpoint overrides saved.');
    } catch (err) {
      const error = err as Error;
      this.errorMsg.set(error.message);
      this.successMsg.set('');
    }
  }

  /** Sets the backend URL, pings the server to verify connectivity, and probes `/version`. */
  onSetUrl(): void {
    if (this.urlForm.valid && this.urlForm.value.url) {
      try {
        this.config.setOnlineMode(this.urlForm.value.url);
        this.showEditUrl.set(false);
        this.errorMsg.set('');
        this.pingLog.set([]);
        this.probeBackendVersion();
        this.onPingBackend();
      } catch (err) {
        const error = err as Error;
        this.errorMsg.set(error.message);
        this.pingLog.set([`Invalid URL: ${error.message}`]);
        this.successMsg.set('');
      }
    }
  }

  /**
   * Pings the currently configured backend server, reporting round-trip latency on success
   * or a detailed diagnostic log on failure.
   */
  onPingBackend(): void {
    const targetUrl = this.config.backendUrl();
    if (!targetUrl) {
      return;
    }
    this.config.setConnectionStatus('connecting');
    this.api.pingBackend(targetUrl).subscribe({
      next: (res) => {
        this.config.setConnectionStatus('connected');
        const msg = `Connected! (ping: ${res.status} in ${res.latencyMs}ms)`;
        this.successMsg.set(msg);
        this.errorMsg.set('');
        this.pingLog.set([]);
        this.logger.info(`Backend ping succeeded: ${res.endpoint} (${res.latencyMs}ms)`);
      },
      error: (err: unknown) => {
        this.config.setConnectionStatus('error');
        const failure = err as Partial<PingFailureError>;
        const message =
          typeof failure.message === 'string' && failure.message.length > 0
            ? failure.message
            : `Ping failed for ${targetUrl}`;
        const logs =
          Array.isArray(failure.logs) && failure.logs.length > 0
            ? failure.logs
            : [this.api.formatPingError(`${targetUrl}/health`, err)];
        this.successMsg.set('');
        this.errorMsg.set(message);
        this.pingLog.set(logs);
        this.logger.error(message, logs);
      },
    });
  }

  /**
   * Queries `GET /version` on the connected backend if available to populate gateway version metadata.
   */
  private probeBackendVersion(): void {
    try {
      this.api.getVersion().subscribe({
        next: (ver) => {
          this.config.setVersionInfo(ver);
        },
        error: () => {
          // Non-fatal if /version is not exposed on custom backend
        },
      });
    } catch {
      // Ignore synchronous errors in test doubles
    }
  }

  /** Switches back to offline mode. */
  goOffline(): void {
    this.config.setOfflineMode();
    this.showEditUrl.set(false);
    this.successMsg.set('Now offline.');
    this.errorMsg.set('');
    this.pingLog.set([]);
  }

  /** Logs into the backend. */
  onLogin(): void {
    if (this.authForm.valid) {
      this.api
        .login(
          this.authForm.value as {
            /** Account username. */
            username: string;
            /** Account password. */
            password: string;
          },
        )
        .subscribe({
          next: (res) => {
            this.authService.setToken(res.token);
            this.successMsg.set('Logged in successfully!');
            this.errorMsg.set('');
          },
          error: () => {
            this.errorMsg.set('Login failed');
            this.successMsg.set('');
          },
        });
    }
  }

  /** Registers a new user. */
  onRegister(): void {
    if (this.authForm.valid) {
      const rawUsername = this.authForm.value.username || '';
      const email = rawUsername.includes('@') ? rawUsername : `${rawUsername}@example.com`;
      const payload = {
        ...this.authForm.value,
        email,
      };
      this.api
        .register(
          payload as {
            /** Account username. */
            username: string;
            /** Account password. */
            password: string;
            /** Account email address. */
            email: string;
          },
        )
        .subscribe({
          next: (res) => {
            this.authService.setToken(res.token);
            this.successMsg.set('Registered successfully!');
            this.errorMsg.set('');
          },
          error: () => {
            this.errorMsg.set('Registration failed');
            this.successMsg.set('');
          },
        });
    }
  }

  /** Initiates GitHub OAuth Flow */
  onGithubLogin(): void {
    const mockCode = 'mock_oauth_code_' + Math.floor(Math.random() * 10000);

    this.api.loginGithub({ code: mockCode }).subscribe({
      next: (res) => {
        this.authService.setToken(res.token);
        this.successMsg.set('GitHub Login successful!');
        this.errorMsg.set('');
      },
      error: () => {
        this.errorMsg.set('GitHub OAuth flow failed. Check backend configuration.');
        this.successMsg.set('');
      },
    });
  }

  /** Initiates Google OAuth Flow (`POST /auth/google`). */
  onGoogleLogin(): void {
    const mockCode = 'mock_google_oauth_code_' + Math.floor(Math.random() * 10000);

    this.api.loginGoogle({ code: mockCode }).subscribe({
      next: (res) => {
        this.authService.setToken(res.token);
        this.successMsg.set('Google Login successful!');
        this.errorMsg.set('');
      },
      error: () => {
        this.errorMsg.set('Google OAuth flow failed. Check backend configuration.');
        this.successMsg.set('');
      },
    });
  }

  /**
   * Links a GitHub or Google OAuth identity to the currently authenticated user.
   * @param provider The OAuth provider to connect (`'github'` or `'google'`).
   */
  async onConnectAccount(provider: OAuthProvider): Promise<void> {
    try {
      const mockCode = `connect_${provider}_code_${Math.floor(Math.random() * 10000)}`;
      await this.authService.completeAccountConnectOAuth(provider, mockCode);
      this.successMsg.set(
        `${provider === 'google' ? 'Google' : 'GitHub'} account linked successfully!`,
      );
      this.errorMsg.set('');
    } catch (err) {
      const error = err as Error;
      this.errorMsg.set(error.message || 'Failed to link account.');
      this.successMsg.set('');
    }
  }

  /**
   * Disconnects an authentication provider (`github` or `google`) from the currently authenticated user.
   * @param provider Authentication provider to disconnect.
   */
  async onDisconnectAccount(provider: AuthMethod): Promise<void> {
    try {
      await this.authService.disconnectProvider(provider);
      this.successMsg.set(`${provider === 'google' ? 'Google' : 'GitHub'} account disconnected.`);
      this.errorMsg.set('');
    } catch (err) {
      const error = err as Error;
      this.errorMsg.set(error.message || 'Failed to disconnect account.');
      this.successMsg.set('');
    }
  }
}
