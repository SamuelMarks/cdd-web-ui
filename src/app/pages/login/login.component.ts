/**
 * Login page component supporting backend server URL configuration, email/password, registration, and OAuth authentication.
 * @module app/pages/login/login.component
 */
import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { BackendConfigService } from '../../services/backend-config.service';
import { ApiService } from '../../services/api.service';
import { LoggingService } from '../../services/logging.service';
import { PingFailureError } from '../../models/types';

/**
 * Component that displays the login page with Backend URL configuration, OAuth options, and Email/Password/Registration.
 */
@Component({
  selector: 'app-login',
  imports: [
    NgOptimizedImage,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1 i18n="@@loginTitle">CDD Control Plane</h1>
        <p i18n="@@loginDescription">
          Sign in to manage your organizations, repositories, and secrets.
        </p>

        <form
          [formGroup]="backendUrlForm"
          (ngSubmit)="onConnectBackend()"
          class="backend-url-form"
          aria-label="Backend Server Configuration"
        >
          <mat-form-field appearance="outline" class="full-width">
            <mat-label i18n="@@loginBackendUrlLabel">Backend Server URL</mat-label>
            <input
              matInput
              type="url"
              formControlName="url"
              placeholder="http://localhost:8086"
              i18n-placeholder="@@loginBackendUrlPlaceholder"
            />
          </mat-form-field>
          <div class="backend-url-actions">
            <button
              mat-stroked-button
              type="submit"
              class="connect-backend-btn"
              [disabled]="backendUrlForm.invalid"
              i18n="@@loginConnectBackendBtn"
            >
              Connect Backend
            </button>
            @if (config.isOnline()) {
              <span class="online-pill" role="status" i18n="@@loginOnlinePill">
                Online: {{ config.backendUrl() }}
              </span>
            }
          </div>
          @if (backendStatusMessage()) {
            <p class="backend-status" role="status" aria-live="polite">
              {{ backendStatusMessage() }}
            </p>
          }
          @if (backendPingLog().length > 0) {
            <pre class="ping-log" role="log" aria-label="Backend ping failure log">{{
              backendPingLog().join(
                '
'
              )
            }}</pre>
          }
        </form>

        @if (errorMessage()) {
          <div class="error-message" role="alert">
            {{ errorMessage() }}
          </div>
        }

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
          @if (isRegisterMode()) {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label i18n="@@loginUsernameLabel">Username</mat-label>
              <input matInput type="text" formControlName="username" autocomplete="username" />
            </mat-form-field>
          }

          <mat-form-field appearance="outline" class="full-width">
            <mat-label i18n>Email address</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="email" required />
            @if (loginForm.controls.email.hasError('required')) {
              <mat-error i18n>Email is required</mat-error>
            }
            @if (loginForm.controls.email.hasError('email')) {
              <mat-error i18n>Please enter a valid email address</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label i18n>Password</mat-label>
            <input
              matInput
              type="password"
              formControlName="password"
              autocomplete="current-password"
              required
            />
            @if (loginForm.controls.password.hasError('required')) {
              <mat-error i18n>Password is required</mat-error>
            }
          </mat-form-field>

          <button
            mat-flat-button
            class="full-width submit-btn"
            type="submit"
            [disabled]="loginForm.invalid || isSubmitting()"
          >
            @if (isSubmitting()) {
              <mat-spinner diameter="20" class="spinner"></mat-spinner>
            } @else if (isRegisterMode()) {
              <span i18n="@@createAccountBtn">Create account</span>
            } @else {
              <span i18n>Sign in</span>
            }
          </button>

          <button mat-button type="button" class="toggle-mode-btn" (click)="toggleRegisterMode()">
            @if (isRegisterMode()) {
              <span i18n="@@switchToSignIn">Already have an account? Sign in</span>
            } @else {
              <span i18n="@@switchToRegister">Need an account? Register</span>
            }
          </button>
        </form>

        <div class="divider">
          <span i18n>or</span>
        </div>

        <div class="auth-buttons">
          <button class="btn btn-github" (click)="login('github')" type="button">
            <img ngSrc="assets/icons/github.svg" alt="" aria-hidden="true" width="20" height="20" />
            <span i18n="@@continueWithGithub">Continue with GitHub</span>
          </button>

          <button class="btn btn-google" (click)="login('google')" type="button">
            <img ngSrc="assets/icons/google.svg" alt="" aria-hidden="true" width="20" height="20" />
            <span i18n="@@continueWithGoogle">Continue with Google</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
    }
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100%;
      padding: 1.5rem 1rem;
      box-sizing: border-box;
      background-color: var(--bg-color);
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
    }
    .login-card {
      background-color: var(--surface-color);
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
      text-align: center;
      margin: auto;
    }
    h1 {
      margin-top: 0;
      color: var(--text-primary);
      font-size: 1.5rem;
    }
    p {
      color: var(--text-secondary);
      margin-bottom: 1.5rem;
    }
    .backend-url-form {
      margin-bottom: 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
      text-align: left;
    }
    .backend-url-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .online-pill {
      font-size: 0.75rem;
      color: var(--primary-color);
      font-weight: 600;
    }
    .backend-status {
      margin: 0.5rem 0 0;
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }
    .ping-log {
      background-color: var(--bg-color, #1e1e1e);
      color: var(--error-text, #d93025);
      border: 1px solid var(--border-color, #dadce0);
      border-radius: 4px;
      padding: 0.5rem 0.75rem;
      font-family: monospace;
      font-size: 0.75rem;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0.5rem 0 0;
      text-align: left;
    }
    .error-message {
      background-color: var(--error-bg);
      color: var(--error-text);
      padding: 0.75rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
      border: 1px solid var(--error-text);
      font-size: 0.875rem;
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .full-width {
      width: 100%;
    }
    .submit-btn {
      margin-bottom: 0.5rem;
      padding: 1.25rem 0;
    }
    .spinner {
      margin: 0 auto;
    }
    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      color: var(--text-secondary);
      margin: 1rem 0;
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
    }
    .auth-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition:
        background-color 0.2s,
        box-shadow 0.2s;
    }
    .btn-github {
      background-color: #24292f;
      color: #ffffff;
    }
    .btn-github:hover {
      background-color: #000000;
    }
    .btn-google {
      background-color: #ffffff;
      color: #3c4043;
      border-color: #dadce0;
    }
    .btn-google:hover {
      background-color: #f8f9fa;
    }
  `,
})
export class LoginComponent {
  /** The authentication service used to initiate login. */
  private readonly authService = inject(AuthService);
  /** The backend configuration service for setting the server URL. */
  readonly config = inject(BackendConfigService);
  /** The API service for pinging the backend server. */
  private readonly api = inject(ApiService);
  /** The logging service for recording ping events and failure diagnostics. */
  private readonly logger = inject(LoggingService);
  /** The form builder. */
  private readonly fb = inject(FormBuilder);
  /** The router to navigate after login. */
  private readonly router = inject(Router);

  /** Signal to track submission state. */
  readonly isSubmitting = signal(false);
  /** Signal to track error messages. */
  readonly errorMessage = signal<string | null>(null);
  /** Signal to track whether registration mode is active. */
  readonly isRegisterMode = signal(false);
  /** Signal to track backend URL connection feedback. */
  readonly backendStatusMessage = signal<string | null>(null);
  /** Signal holding diagnostic log lines when pinging the backend fails. */
  readonly backendPingLog = signal<string[]>([]);

  /** Form group for configuring the backend server URL on the login page. */
  readonly backendUrlForm = this.fb.nonNullable.group({
    url: [this.config.backendUrl() || 'http://localhost:8080', [Validators.required]],
  });

  /** The login/registration form group. */
  readonly loginForm = this.fb.nonNullable.group({
    username: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /**
   * Connects to the specified backend server URL, enables online mode, and pings the server
   * to verify connectivity or display a diagnostic failure log.
   */
  onConnectBackend(): void {
    const rawUrl = this.backendUrlForm.controls.url.value;
    if (!rawUrl) {
      return;
    }
    try {
      this.config.setOnlineMode(rawUrl);
      this.errorMessage.set(null);
      this.backendPingLog.set([]);
      const normalizedUrl = this.config.backendUrl() ?? rawUrl;
      this.config.setConnectionStatus('connecting');
      this.api.pingBackend(normalizedUrl).subscribe({
        next: (res) => {
          this.config.setConnectionStatus('connected');
          this.backendStatusMessage.set(`Connected! (ping: ${res.status} in ${res.latencyMs}ms)`);
          this.errorMessage.set(null);
          this.backendPingLog.set([]);
          this.logger.info(`Backend ping succeeded: ${res.endpoint} (${res.latencyMs}ms)`);
        },
        error: (err: unknown) => {
          this.config.setConnectionStatus('error');
          const failure = err as Partial<PingFailureError>;
          const message =
            typeof failure.message === 'string' && failure.message.length > 0
              ? failure.message
              : `Ping failed for ${normalizedUrl}`;
          const logs =
            Array.isArray(failure.logs) && failure.logs.length > 0
              ? failure.logs
              : [this.api.formatPingError(`${normalizedUrl}/health`, err)];
          this.backendStatusMessage.set(null);
          this.errorMessage.set(message);
          this.backendPingLog.set(logs);
          this.logger.error(message, logs);
        },
      });
    } catch (err) {
      const error = err as Error;
      this.errorMessage.set(error.message);
      this.backendStatusMessage.set(null);
      this.backendPingLog.set([`Invalid URL: ${error.message}`]);
    }
  }

  /**
   * Toggles between Sign In and Create Account (Register) mode.
   */
  toggleRegisterMode(): void {
    this.isRegisterMode.update((v) => !v);
    this.errorMessage.set(null);
  }

  /**
   * Extracts a human-readable error message from an `Error`, `HttpErrorResponse`, or backend error payload.
   * @param error The caught rejection value.
   * @returns Human-readable error message string.
   */
  extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      if (record['status'] === 0) {
        return 'Unable to reach backend server. Ensure the backend is running or switch to Offline Mode.';
      }
      const nested = record['error'];
      if (typeof nested === 'string' && nested.trim().length > 0) {
        return nested;
      }
      if (nested && typeof nested === 'object') {
        const nestedRec = nested as Record<string, unknown>;
        if (typeof nestedRec['error'] === 'string' && nestedRec['error'].trim().length > 0) {
          return nestedRec['error'];
        }
        if (typeof nestedRec['message'] === 'string' && nestedRec['message'].trim().length > 0) {
          return nestedRec['message'];
        }
      }
      if (typeof record['message'] === 'string' && record['message'].trim().length > 0) {
        return record['message'];
      }
    }
    return 'An unknown error occurred during login.';
  }

  /**
   * Handles the submission of the email/password login or registration form.
   */
  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { username, email, password } = this.loginForm.getRawValue();

    try {
      if (this.isRegisterMode()) {
        const derivedUsername = username.trim() || email.split('@')[0];
        await this.authService.register(derivedUsername, email, password);
      } else {
        await this.authService.loginWithEmail(email, password);
      }
      void this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage.set(this.extractErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Initiates the login flow for the specified provider.
   * @param provider The OAuth provider to authenticate with ('github' or 'google').
   */
  login(provider: 'github' | 'google'): void {
    this.authService.loginWithProvider(provider);
  }
}
