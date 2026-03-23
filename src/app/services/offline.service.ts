import { Injectable, signal } from '@angular/core';

/**
 * Service to manage and detect the application's offline status using the browser's navigator APIs.
 */
@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  /** Signal indicating whether the browser is currently online. */
  readonly isOnline = signal<boolean>(true);

  /** Creates and initializes the offline service. */
  constructor() {
    this.init();
  }

  /**
   * Initializes the offline detection by checking `navigator.onLine` 
   * and attaching event listeners to `window`.
   */
  private init(): void {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      this.isOnline.set(navigator.onLine);

      window.addEventListener('online', () => this.isOnline.set(true));
      window.addEventListener('offline', () => this.isOnline.set(false));
    }
  }

  /**
   * Allows manual override of the online state (useful for testing or manual toggles).
   * @param online The new online state.
   */
  setOnlineState(online: boolean): void {
    this.isOnline.set(online);
  }
}
