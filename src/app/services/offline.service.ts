import { Injectable, signal, inject } from '@angular/core';
import { WINDOW } from '../tokens';

/**
 * Service to manage and detect the application's offline status using the browser's navigator APIs.
 */
@Injectable({
  providedIn: 'root',
})
/** OfflineService */
export class OfflineService {
  /** Window token */
  private readonly window = inject(WINDOW);

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
    if (this.window && this.window.navigator) {
      this.isOnline.set(this.window.navigator.onLine);

      this.window.addEventListener('online', () => this.isOnline.set(true));
      this.window.addEventListener('offline', () => this.isOnline.set(false));
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
