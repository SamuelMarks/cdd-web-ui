import { Injectable, signal, computed } from '@angular/core';

/**
 * Service to manage backend connection configuration (Online vs Offline mode).
 */
@Injectable({
  providedIn: 'root',
})
/** BackendConfigService */
export class BackendConfigService {
  /** The local storage key for the backend URL. */
  private readonly BACKEND_URL_KEY = 'cdd_backend_url';

  /** Signal holding the current backend URL. Null means offline mode. */
  readonly backendUrl = signal<string | null>(this.loadFromStorage());

  /** Computed signal indicating whether the application is currently in online mode. */
  readonly isOnline = computed(() => this.backendUrl() !== null);

  /**
   * Initializes the backend configuration service.
   */
  constructor() {}

  /**
   * Retrieves the backend URL from local storage.
   * @returns The saved URL, or null if none is saved.
   */
  private loadFromStorage(): string | null {
    return localStorage.getItem(this.BACKEND_URL_KEY);
  }

  /**
   * Enables online mode by setting the backend URL.
   * @param url The URL of the backend API.
   */
  setOnlineMode(url: string): void {
    try {
      new URL(url);
      this.backendUrl.set(url);
      localStorage.setItem(this.BACKEND_URL_KEY, url);
    } catch {
      throw new Error('Invalid URL provided for backend config.');
    }
  }

  /**
   * Disables online mode, reverting the application to offline mode.
   */
  setOfflineMode(): void {
    this.backendUrl.set(null);
    localStorage.removeItem(this.BACKEND_URL_KEY);
  }
}
