import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

/**
 * Component that displays the login page with OAuth options and Email/Password.
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

        @if (errorMessage()) {
          <div class="error-message" role="alert">
            {{ errorMessage() }}
          </div>
        }

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
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
            color="primary"
            class="full-width submit-btn"
            type="submit"
            [disabled]="loginForm.invalid || isSubmitting()"
          >
            @if (isSubmitting()) {
              <mat-spinner diameter="20" class="spinner"></mat-spinner>
            } @else {
              <span i18n>Sign in</span>
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
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background-color: var(--color-bg-subtle, #f5f5f5);
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
    }
    .login-card {
      background-color: var(--color-bg-default, #ffffff);
      padding: 2.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    h1 {
      margin-top: 0;
      color: var(--color-text-default, #24292f);
      font-size: 1.5rem;
    }
    p {
      color: var(--color-text-muted, #57606a);
      margin-bottom: 1.5rem;
    }
    .error-message {
      background-color: #ffebe9;
      color: #cf222e;
      padding: 0.75rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
      border: 1px solid #ff818266;
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
      margin-bottom: 1rem;
      padding: 1.25rem 0;
    }
    .spinner {
      margin: 0 auto;
    }
    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      color: var(--color-text-muted, #57606a);
      margin: 1rem 0;
    }
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid var(--border-color, #e0e0e0);
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
  /** The form builder. */
  private readonly fb = inject(FormBuilder);
  /** The router to navigate after login. */
  private readonly router = inject(Router);

  /** Signal to track submission state. */
  readonly isSubmitting = signal(false);
  /** Signal to track error messages. */
  readonly errorMessage = signal<string | null>(null);

  /** The login form group. */
  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /**
   * Handles the submission of the email/password form.
   */
  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.getRawValue();

    try {
      await this.authService.loginWithEmail(email, password);
      void this.router.navigate(['/dashboard']);
    } catch (error) {
      if (error instanceof Error) {
        this.errorMessage.set(error.message);
      } else {
        this.errorMessage.set('An unknown error occurred during login.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Initiates the login flow for the specified provider.
   * @param provider The OAuth provider to authenticate with ('github' or 'google').
   */
  login(provider: 'github' | 'google') {
    this.authService.loginWithProvider(provider);
  }
}
