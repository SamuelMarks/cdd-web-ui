/**
 * Authentication service managing JWT tokens and user session state.
 * @module app/services/auth.service
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiService, AuthResponse } from './api.service';
import { BackendConfigService } from './backend-config.service';
import { JwtClaims } from '../models/types';
import { GLOBAL_DATE } from '../tokens';

/**
 * Interface representing the authenticated user's profile.
 */
export interface UserProfile {
  /** The unique identifier of the user. */
  id: string;
  /** Optional account login username from JWT claims. */
  username?: string;
  /** The email address of the user. */
  email: string;
  /** The display name of the user. */
  name: string;
  /** The URL of the user's avatar image. */
  avatarUrl: string;
}

/**
 * Interface representing the internal authentication state.
 */
interface AuthState {
  /** The JWT authentication token, or null if not authenticated. */
  token: string | null;
  /** The user's profile, or null if not loaded/authenticated. */
  profile: UserProfile | null;
}

/**
 * Service responsible for handling authentication, managing the JWT session,
 * and storing user profile state.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  /** Key used for storing the auth token in localStorage. */
  private readonly TOKEN_KEY = 'cdd_auth_token';
  /** Angular Router instance for navigation. */
  private readonly router = inject(Router);
  /** Injected Document instance for safe DOM/window access. */
  private readonly document = inject(DOCUMENT);
  /** Injected API service for backend authentication requests. */
  private readonly api = inject(ApiService);
  /** Injected backend configuration service. */
  private readonly config = inject(BackendConfigService);
  /** Injected global Date constructor. */
  private readonly globalDate = inject(GLOBAL_DATE);

  /** Signal holding the current authentication state. */
  private readonly state = signal<AuthState>({
    token: localStorage.getItem(this.TOKEN_KEY),
    profile: null,
  });

  /** In-memory map of credentials registered while in offline demo mode. */
  private readonly offlineRegisteredUsers = new Map<string, string>();

  /** Computed signal for the current authentication token. */
  readonly token = computed(() => this.state().token);
  /** Computed signal for the current user profile. */
  readonly profile = computed(() => this.state().profile);
  /** Computed signal indicating whether the user is currently authenticated. */
  readonly isAuthenticated = computed(() => !!this.state().token);

  /**
   * Initializes the AuthService and loads the user profile if a token exists in storage.
   */
  constructor() {
    if (this.token()) {
      this.loadProfile();
    }
  }

  /**
   * Decodes and validates a JWT token's payload claims (`sub`, `exp`, `username`).
   * @param token Raw JWT string.
   * @returns Parsed `JwtClaims` if valid and unexpired, or `null` otherwise.
   */
  decodeJwtClaims(token: string): JwtClaims | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const json = atob(padded);
      const parsed: unknown = JSON.parse(json);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        const sub = typeof record['sub'] === 'number' ? record['sub'] : Number(record['sub']);
        const exp = typeof record['exp'] === 'number' ? record['exp'] : Number(record['exp']);
        const username = typeof record['username'] === 'string' ? record['username'] : '';
        if (!Number.isNaN(sub) && !Number.isNaN(exp) && username.length > 0) {
          const nowSecs = Math.floor(this.globalDate.now() / 1000);
          if (exp > nowSecs) {
            return { sub, exp, username };
          }
        }
      }
    } catch {
      // Fall through and return null for non-JWT or malformed tokens
    }
    return null;
  }

  /**
   * Checks whether a caught error represents an HTTP status 0 network unreachable error.
   * @param error The caught rejection value.
   * @returns `true` if `error` is an object with `status === 0`.
   */
  private isUnreachableError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as Record<string, unknown>)['status'] === 0
    );
  }

  /**
   * Executes an authentication operation and, if the currently configured backend URL is
   * unreachable (`status === 0`, e.g. `:8086` when local `:8080`/`:8083` is running),
   * automatically probes local fallback URLs (`http://localhost:8080`, `http://localhost:8083`).
   * @param operation Callback performing the authentication request.
   * @returns Promise resolving to the `AuthResponse`.
   */
  private async executeWithLocalFallback(
    operation: () => Promise<AuthResponse>,
  ): Promise<AuthResponse> {
    try {
      return await operation();
    } catch (err) {
      if (!this.isUnreachableError(err)) {
        throw err;
      }
      const currentUrl = this.config.backendUrl();
      const fallbacks = ['http://localhost:8080', 'http://localhost:8083'].filter(
        (u) => u !== currentUrl,
      );
      for (const candidate of fallbacks) {
        this.config.setOnlineMode(candidate);
        try {
          return await operation();
        } catch (retryErr) {
          if (!this.isUnreachableError(retryErr)) {
            throw retryErr;
          }
        }
      }
      if (currentUrl) {
        this.config.setOnlineMode(currentUrl);
      }
      throw err;
    }
  }

  /**
   * Authenticates a user against the configured backend via username and password (`POST /auth/login`).
   * Automatically retries with the local-part before `@` if an email address was supplied.
   * @param username The account username or email address.
   * @param password The account password.
   * @returns A promise resolving to the backend `AuthResponse`.
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await this.executeWithLocalFallback(async () => {
      try {
        return await firstValueFrom(this.api.login({ username, password }));
      } catch (err) {
        if (!this.isUnreachableError(err) && username.includes('@')) {
          const prefix = username.split('@')[0];
          return await firstValueFrom(this.api.login({ username: prefix, password }));
        }
        throw err;
      }
    });
    this.setToken(response.token);
    return response;
  }

  /**
   * Registers a new user account against the configured backend (`POST /auth/register`),
   * or in the local demo session when offline mode is active.
   * @param username The desired username.
   * @param email The user's email address.
   * @param password The user's password.
   * @returns A promise resolving to the backend `AuthResponse`.
   */
  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    if (!this.config.isOnline()) {
      this.offlineRegisteredUsers.set(email.toLowerCase(), password);
      this.offlineRegisteredUsers.set(username.toLowerCase(), password);
      const offlineResponse: AuthResponse = { token: 'mock-email-jwt-token' };
      this.setToken(offlineResponse.token);
      return offlineResponse;
    }
    const response = await this.executeWithLocalFallback(() =>
      firstValueFrom(this.api.register({ username, email, password })),
    );
    this.setToken(response.token);
    return response;
  }

  /**
   * Authenticates a user with their email/username and password.
   * Uses the live backend API when online mode is active, or offline demo credentials otherwise.
   * @param email The user's email address or username.
   * @param password The user's password.
   * @returns A promise that resolves when authentication succeeds or rejects with an error.
   */
  async loginWithEmail(email: string, password: string): Promise<void> {
    if (this.config.isOnline()) {
      await this.login(email, password);
      return;
    }
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const registeredPassword = this.offlineRegisteredUsers.get(email.toLowerCase());
        if (
          (email === 'admin@example.com' && password === 'admin') ||
          (registeredPassword !== undefined && registeredPassword === password)
        ) {
          this.setToken('mock-email-jwt-token');
          resolve();
        } else {
          reject(new Error('Invalid email or password'));
        }
      }, 500);
    });
  }

  /**
   * Completes the GitHub OAuth code exchange (`POST /auth/github`) and stores the resulting JWT.
   * @param code The OAuth authorization code returned by GitHub.
   * @returns A promise resolving to the `AuthResponse`.
   */
  async completeGithubOAuth(code: string): Promise<AuthResponse> {
    const response = await firstValueFrom(this.api.loginGithub({ code }));
    this.setToken(response.token);
    return response;
  }

  /**
   * Deletes the currently authenticated user account on the backend (when online) and clears the local session.
   * @returns A promise that resolves once the account is deleted and the user is logged out.
   */
  async deleteAccount(): Promise<void> {
    if (this.config.isOnline()) {
      await firstValueFrom(this.api.deleteAccount(this.token() ?? undefined));
    }
    this.logout();
  }

  /**
   * Sets the authentication token, persists it to localStorage, and triggers profile loading.
   * @param token The JWT token received from the backend.
   */
  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.state.update((state) => ({ ...state, token }));
    this.loadProfile();
  }

  /**
   * Logs out the current user by clearing the token from localStorage, resetting state,
   * and navigating to the login page.
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.state.set({ token: null, profile: null });
    void this.router.navigate(['/login']);
  }

  /**
   * Initiates the OAuth login flow by redirecting the browser to the configured backend's auth endpoint.
   * @param provider The OAuth provider to use ('github' or 'google').
   */
  loginWithProvider(provider: 'github' | 'google'): void {
    const baseUrl = this.config.backendUrl() ?? 'http://localhost:3000';
    this.document.location.href = `${baseUrl}/auth/${provider}`;
  }

  /**
   * Loads the user's profile from JWT claims if present, or falls back to demo profile data.
   */
  private loadProfile(): void {
    const claims = this.decodeJwtClaims(this.token() as string);
    if (claims) {
      this.state.update((state) => ({
        ...state,
        profile: {
          id: String(claims.sub),
          username: claims.username,
          email: claims.username.includes('@') ? claims.username : `${claims.username}@cdd.local`,
          name: claims.username,
          avatarUrl: `https://github.com/identicons/${encodeURIComponent(claims.username)}.png`,
        },
      }));
      return;
    }

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
