import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Component that handles the OAuth callback from the control plane.
 */
@Component({
  selector: 'app-auth-callback',
  imports: [],
  template: `
    <div class="callback-container">
      <div class="spinner"></div>
      <p>Completing sign in...</p>
    </div>
  `,
  styles: `
    .callback-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid var(--color-border-default, #d0d7de);
      border-top-color: var(--color-accent-emphasis, #0969da);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `
})
export class AuthCallbackComponent implements OnInit {
  /** The activated route containing query parameters. */
  private readonly route = inject(ActivatedRoute);
  
  /** The router used for navigation after authentication. */
  private readonly router = inject(Router);
  
  /** The authentication service used to store the token. */
  private readonly authService = inject(AuthService);

  /**
   * Initializes the component and attempts to read the token from the query parameters.
   */
  ngOnInit() {
    // The JWT token is expected to be passed as a query parameter from the control plane
    const token = this.route.snapshot.queryParamMap.get('token');
    
    if (token) {
      this.authService.setToken(token);
      void this.router.navigate(['/dashboard']);
    } else {
      // If no token, maybe it's an error, redirect back to login
      console.error('Authentication failed: No token received in callback');
      void this.router.navigate(['/login']);
    }
  }
}
