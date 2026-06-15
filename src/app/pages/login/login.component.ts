import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

/**
 * Component that displays the login page with OAuth options.
 */
@Component({
  selector: 'app-login',
  imports: [],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1>CDD Control Plane</h1>
        <p>Sign in to manage your organizations, repositories, and secrets.</p>
        
        <div class="auth-buttons">
          <button class="btn btn-github" (click)="login('github')">
            <img src="assets/icons/github.svg" alt="GitHub" width="20" height="20" />
            Continue with GitHub
          </button>
          
          <button class="btn btn-google" (click)="login('google')">
            <img src="assets/icons/google.svg" alt="Google" width="20" height="20" />
            Continue with Google
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
      font-family: system-ui, -apple-system, sans-serif;
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
      margin-bottom: 2rem;
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
      transition: background-color 0.2s, box-shadow 0.2s;
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
  `
})
export class LoginComponent {
  /** The authentication service used to initiate login. */
  private readonly authService = inject(AuthService);

  /**
   * Initiates the login flow for the specified provider.
   * @param provider The OAuth provider to authenticate with ('github' or 'google').
   */
  login(provider: 'github' | 'google') {
    this.authService.loginWithProvider(provider);
  }
}
