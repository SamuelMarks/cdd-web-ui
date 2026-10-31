/**
 * OAuth authentication callback handler page component.
 * @module app/pages/auth-callback/auth-callback.component
 */
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Component that handles the OAuth callback from the backend.
 * Extracts either a direct `token` or an OAuth `code` from query parameters,
 * stores the resulting JWT, and redirects the user to the dashboard.
 */
@Component({
  selector: 'app-auth-callback',
  template: `
    <div class="callback-container">
      <div class="spinner" role="status" aria-label="Authenticating"></div>
      <p i18n="@@authenticatingMessage">Authenticating, please wait...</p>
    </div>
  `,
  styles: `
    .callback-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: var(--bg-color);
      color: var(--text-primary);
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
    }
    .spinner {
      border: 4px solid var(--border-color);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border-left-color: var(--primary-color);
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
  `,
})
export class AuthCallbackComponent implements OnInit {
  /** The current activated route to extract query parameters. */
  private readonly route = inject(ActivatedRoute);
  /** The router for navigation after handling the callback. */
  private readonly router = inject(Router);
  /** The authentication service to store the received token. */
  private readonly authService = inject(AuthService);

  /**
   * Initializes the component, checks for the token or OAuth code in the URL, and redirects accordingly.
   */
  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const code = this.route.snapshot.queryParamMap.get('code');
    if (token) {
      this.authService.setToken(token);
      void this.router.navigate(['/dashboard']);
    } else if (code) {
      void this.handleOAuthCode(code);
    } else {
      console.error('Authentication failed: No token received in callback');
      void this.router.navigate(['/login']);
    }
  }

  /**
   * Exchanges a GitHub OAuth code for a JWT via `AuthService.completeGithubOAuth`.
   * @param code The OAuth authorization code.
   */
  private async handleOAuthCode(code: string): Promise<void> {
    try {
      await this.authService.completeGithubOAuth(code);
      void this.router.navigate(['/dashboard']);
    } catch (err) {
      console.error('Authentication failed during OAuth code exchange', err);
      void this.router.navigate(['/login']);
    }
  }
}
