/**
 * OAuth authentication callback handler page component.
 * @module app/pages/auth-callback/auth-callback.component
 */
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { OAuthProvider } from '../../models/types';

/**
 * Component that handles the OAuth callback from the backend.
 * Extracts `token`, `code`, `provider` (`github` | `google`), and `action` (`login` | `connect`)
 * from query parameters or `sessionStorage`, completes authentication or account linking,
 * and redirects the user to the dashboard.
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
  /** The authentication service to store tokens or link accounts. */
  private readonly authService = inject(AuthService);
  /** The notification service to announce account-linking results. */
  private readonly notifications = inject(NotificationService);

  /**
   * Initializes the component, checks for the token or OAuth code in the URL, and redirects accordingly.
   */
  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const code = this.route.snapshot.queryParamMap.get('code');
    if (token) {
      sessionStorage.removeItem('cdd_oauth_intent');
      this.authService.setToken(token);
      void this.router.navigate(['/dashboard']);
    } else if (code) {
      const { action, provider } = this.resolveOAuthIntent();
      void this.handleOAuthCode(code, provider, action);
    } else {
      console.error('Authentication failed: No token received in callback');
      void this.router.navigate(['/login']);
    }
  }

  /**
   * Resolves the OAuth provider (`'github'` or `'google'`) and intent (`'login'` or `'connect'`)
   * from URL query parameters (`provider`, `action`, `state`) or `sessionStorage`.
   * @returns Resolved `action` and `provider`.
   */
  private resolveOAuthIntent(): {
    /** Resolved OAuth intent (`'login'` or `'connect'`). */
    action: 'login' | 'connect';
    /** Resolved OAuth identity provider (`'github'` or `'google'`). */
    provider: OAuthProvider;
  } {
    const storedIntent = sessionStorage.getItem('cdd_oauth_intent') ?? '';
    sessionStorage.removeItem('cdd_oauth_intent');

    const queryAction =
      this.route.snapshot.queryParamMap.get('action') ??
      this.route.snapshot.queryParamMap.get('state') ??
      '';
    const queryProvider = this.route.snapshot.queryParamMap.get('provider') ?? '';

    const combined = `${queryAction}:${queryProvider}:${storedIntent}`.toLowerCase();
    const action: 'login' | 'connect' = combined.includes('connect') ? 'connect' : 'login';
    const provider: OAuthProvider = combined.includes('google') ? 'google' : 'github';
    return { action, provider };
  }

  /**
   * Exchanges an OAuth code for a JWT or links the provider to the current account.
   * @param code The OAuth authorization code.
   * @param provider The OAuth identity provider (`'github'` or `'google'`).
   * @param action Whether this callback is for `'login'` or `'connect'`.
   */
  private async handleOAuthCode(
    code: string,
    provider: OAuthProvider,
    action: 'login' | 'connect',
  ): Promise<void> {
    try {
      if (action === 'connect') {
        await this.authService.completeAccountConnectOAuth(provider, code);
        this.notifications.success(
          `${provider === 'google' ? 'Google' : 'GitHub'} account connected!`,
        );
        void this.router.navigate(['/dashboard']);
        return;
      }
      if (provider === 'google') {
        await this.authService.completeGoogleOAuth(code);
      } else {
        await this.authService.completeGithubOAuth(code);
      }
      void this.router.navigate(['/dashboard']);
    } catch (err) {
      console.error('Authentication failed during OAuth code exchange', err);
      void this.router.navigate([action === 'connect' ? '/dashboard' : '/login']);
    }
  }
}
