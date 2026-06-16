import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';

/**
 * Represents the profile of an authenticated user.
 */
export interface UserProfile {
  /** The unique identifier of the user. */
  id: string;
  /** The email address of the user. */
  email: string;
  /** The display name of the user. */
  name: string;
  /** The optional avatar URL of the user. */
  avatarUrl?: string;
}

/**
 * Represents the authentication state of the application.
 */
export interface AuthState {
  /** The JWT authentication token. */
  token: string | null;
  /** The user profile information. */
  profile: UserProfile | null;
  /** Indicates whether the user is authenticated. */
  isAuthenticated: boolean;
}

/**
 * Service to manage authentication, tokens, and user profiles.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  /** The router used for navigation after logout. */
  private readonly router = inject(Router);
  /** The document used to manipulate the URL location. */
  private readonly document = inject(DOCUMENT);

  // State
  /** The internal authentication state. */
  private readonly state = signal<AuthState>({
    token: localStorage.getItem('cdd_auth_token'),
    profile: null,
    isAuthenticated: !!localStorage.getItem('cdd_auth_token'),
  });

  // Selectors
  /** Computed signal for the JWT token. */
  readonly token = computed(() => this.state().token);
  /** Computed signal for the user profile. */
  readonly profile = computed(() => this.state().profile);
  /** Computed signal for the authentication status. */
  readonly isAuthenticated = computed(() => this.state().isAuthenticated);

  /**
   * Initializes the authentication service.
   * Loads the user profile if a token is present.
   */
  constructor() {
    // If we have a token but no profile, we would typically fetch the profile here
    if (this.token()) {
      this.loadProfile();
    }
  }

  /**
   * Set the JWT token and update auth state.
   * @param token The JWT token to set.
   */
  setToken(token: string): void {
    localStorage.setItem('cdd_auth_token', token);
    this.state.update((state) => ({
      ...state,
      token,
      isAuthenticated: true,
    }));
    this.loadProfile();
  }

  /**
   * Log the user out and clear the session.
   */
  logout(): void {
    localStorage.removeItem('cdd_auth_token');
    this.state.set({
      token: null,
      profile: null,
      isAuthenticated: false,
    });
    void this.router.navigate(['/login']);
  }

  /**
   * Initiate OAuth login flow.
   * @param provider The OAuth provider to use.
   */
  loginWithProvider(provider: 'github' | 'google'): void {
    // In a real app, this URL would come from environment configuration
    // It would redirect the user to the backend OAuth initiation endpoint
    const controlPlaneUrl = /* environment.controlPlaneUrl || */ 'http://localhost:3000';
    this.document.location.href = `${controlPlaneUrl}/auth/${provider}`;
  }

  /**
   * Load user profile based on the current token.
   */
  private loadProfile(): void {
    // Mocking profile load. In a real app, this would be an HTTP GET to /api/me
    // using the token in the Authorization header.
    // Assuming token is valid, we set a mock profile.
    setTimeout(() => {
      this.state.update((state) => ({
        ...state,
        profile: {
          id: 'user-123',
          email: 'user@example.com',
          name: 'Demo User',
          avatarUrl: 'https://github.com/identicons/demo.png',
        },
      }));
    }, 500);
  }
}
