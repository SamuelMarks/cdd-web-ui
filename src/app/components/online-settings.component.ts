import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { BackendConfigService } from '../services/backend-config.service';
import { ApiService } from '../services/api.service';

/**
 * Dialog for configuring online mode.
 */
@Component({
  selector: 'app-online-settings',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title id="dialog-title" i18n="@@onlineSettingsTitle">Online Mode Settings</h2>
    <mat-dialog-content>
      @if (config.isOnline()) {
        <p i18n="@@currentlyOnline">Currently Online: {{ config.backendUrl() }}</p>
        <button
          mat-flat-button
          color="warn"
          (click)="goOffline()"
          aria-label="Disconnect and go offline"
          i18n="@@goOffline"
        >
          Go Offline
        </button>
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
              placeholder="http://localhost:8080"
              i18n-placeholder="@@backendUrlPlaceholder"
              aria-label="Backend URL"
            />
            @if (urlForm.get('url')?.hasError('required')) {
              <mat-error i18n="@@urlRequiredError">URL is required</mat-error>
            }
          </mat-form-field>
          <button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="urlForm.invalid"
            aria-label="Connect to backend"
            i18n="@@connectBtn"
          >
            Connect
          </button>
        </form>
      }

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
              <input matInput formControlName="username" aria-label="Username" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label i18n="@@passwordLabel">Password</mat-label>
              <input matInput type="password" formControlName="password" aria-label="Password" />
            </mat-form-field>
            <div class="actions">
              <button
                mat-stroked-button
                color="primary"
                type="submit"
                [disabled]="authForm.invalid"
                aria-label="Login"
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
                aria-label="Register new user"
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
            <button
              mat-flat-button
              class="github-btn full-width"
              (click)="onGithubLogin()"
              aria-label="Login with GitHub"
            >
              <!-- Using standard text icon if SVG isn't immediately available, or we could just use a mat-icon text fallback. -->
              <mat-icon class="github-icon" aria-hidden="true">code</mat-icon>
              <span i18n="@@loginWithGithubBtn">Login with GitHub</span>
            </button>
          </div>

          @if (errorMsg()) {
            <p class="error" role="alert" aria-live="assertive">{{ errorMsg() }}</p>
          }
          @if (successMsg()) {
            <p class="success" role="status" aria-live="polite">{{ successMsg() }}</p>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close aria-label="Close dialog" i18n="@@closeBtn">Close</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .auth-section {
        margin-top: 2rem;
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
      .github-btn {
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
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnlineSettingsComponent {
  /** Access to backend config state. */
  readonly config = inject(BackendConfigService);
  /** Form builder instance for reactive forms. */
  private readonly fb = inject(FormBuilder);
  /** Reference to the dialog instance. */
  private readonly dialogRef = inject(MatDialogRef<OnlineSettingsComponent>);
  /** API service for backend communication. */
  private readonly api = inject(ApiService);

  /** Signal for error message. */
  readonly errorMsg = signal<string>('');
  /** Signal for success message. */
  readonly successMsg = signal<string>('');

  /** Form for setting backend URL. */
  urlForm = this.fb.group({
    url: [this.config.backendUrl() || '', Validators.required],
  });

  /** Form for authentication. */
  authForm = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  /** Connects to the provided URL. */
  onSetUrl(): void {
    if (this.urlForm.valid && this.urlForm.value.url) {
      try {
        this.config.setOnlineMode(this.urlForm.value.url);
        this.errorMsg.set('');
        this.successMsg.set('Connected!');
      } catch (err) {
        const error = err as Error;
        this.errorMsg.set(error.message);
      }
    }
  }

  /** Switches back to offline mode. */
  goOffline(): void {
    this.config.setOfflineMode();
    this.successMsg.set('Now offline.');
    this.errorMsg.set('');
  }

  /** Logs into the backend. */
  onLogin(): void {
    if (this.authForm.valid) {
      this.api.login(this.authForm.value as { username: string; password: string }).subscribe({
        next: (res) => {
          localStorage.setItem('cdd_token', res.token);
          this.successMsg.set('Logged in successfully!');
          this.errorMsg.set('');
        },
        error: (err) => {
          this.errorMsg.set('Login failed');
          this.successMsg.set('');
        },
      });
    }
  }

  /** Registers a new user. */
  onRegister(): void {
    if (this.authForm.valid) {
      const payload = {
        ...this.authForm.value,
        email: `${this.authForm.value.username}@example.com`,
      };
      this.api
        .register(payload as { username: string; password: string; email: string })
        .subscribe({
          next: (res) => {
            localStorage.setItem('cdd_token', res.token);
            this.successMsg.set('Registered successfully!');
            this.errorMsg.set('');
          },
          error: (err) => {
            this.errorMsg.set('Registration failed');
            this.successMsg.set('');
          },
        });
    }
  }

  /** Initiates GitHub OAuth Flow */
  onGithubLogin(): void {
    // In a real application, this would redirect to GitHub's OAuth authorize endpoint.
    // GitHub redirects back with a ?code=xxx parameter.
    // The frontend then extracts the code and sends it to the backend via `this.api.loginGithub()`.

    // For this prototype, we simulate a successful OAuth return flow
    // by immediately calling the endpoint with a mock code.
    const mockCode = 'mock_oauth_code_' + Math.floor(Math.random() * 10000);

    this.api.loginGithub({ code: mockCode }).subscribe({
      next: (res) => {
        localStorage.setItem('cdd_token', res.token);
        this.successMsg.set('GitHub Login successful!');
        this.errorMsg.set('');
      },
      error: (err) => {
        this.errorMsg.set('GitHub OAuth flow failed. Check backend configuration.');
        this.successMsg.set('');
      },
    });
  }
}
