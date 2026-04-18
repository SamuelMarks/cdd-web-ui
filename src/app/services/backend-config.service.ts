import { Injectable, signal, computed } from '@angular/core';
import { RunMode } from '../models/types';

/**
 * Service to manage backend connection configuration (Online vs Offline mode) and the run mode.
 */
@Injectable({
  providedIn: 'root',
})
/** BackendConfigService */
export class BackendConfigService {
  /** The local storage key for the backend URL. */
  private readonly BACKEND_URL_KEY = 'cdd_backend_url';
  /** The local storage key for the run mode. */
  private readonly RUN_MODE_KEY = 'cdd_run_mode';

  /** Signal holding the current backend URL. Null means offline mode. */
  readonly backendUrl = signal<string | null>(this.loadFromStorage());

  /** Signal holding the current execution mode. */
  readonly runMode = signal<RunMode>(this.loadRunMode());

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
   * Retrieves the run mode from local storage.
   * @returns The saved run mode, defaulting to local_relative.
   */
  private loadRunMode(): RunMode {
    const stored = localStorage.getItem(this.RUN_MODE_KEY);
    if (
      stored === 'local_relative' ||
      stored === 'local_cdd_ctl_wasm' ||
      stored === 'local_cdd_ctl_native' ||
      stored === 'served_github'
    ) {
      return stored as RunMode;
    }
    return 'local_relative';
  }

  /**
   * Sets the execution run mode.
   * @param mode The selected run mode.
   */
  setRunMode(mode: RunMode): void {
    this.runMode.set(mode);
    localStorage.setItem(this.RUN_MODE_KEY, mode);
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
