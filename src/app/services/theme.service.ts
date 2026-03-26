import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/**
 * Service to manage light/dark theme toggling and persistence.
 */
@Injectable({
  providedIn: 'root',
})
/** ThemeService */
export class ThemeService {
  /** The local storage key for persisting the selected theme. */
  private readonly STORAGE_KEY = 'cdd_theme';
  /** The injected DOM document instance. */
  private readonly document = inject(DOCUMENT);
  /** The injected platform ID to determine the environment. */
  private readonly platformId = inject(PLATFORM_ID);

  /** Signal indicating if dark mode is currently active. */
  readonly isDarkTheme = signal<boolean>(this.loadInitialTheme());

  /**
   * Initializes the theme service and sets up an effect to apply theme changes to the DOM.
   */
  constructor() {
    // Automatically apply the theme class whenever the signal changes
    effect(() => {
      const dark = this.isDarkTheme();
      if (isPlatformBrowser(this.platformId)) {
        if (dark) {
          this.document.documentElement.classList.add('dark-theme');
        } else {
          this.document.documentElement.classList.remove('dark-theme');
        }
        localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
      }
    });
  }

  /**
   * Toggles the current theme.
   */
  toggleTheme(): void {
    this.isDarkTheme.update((dark) => !dark);
  }

  /**
   * Sets a specific theme.
   * @param dark True for dark theme, false for light theme.
   */
  setTheme(dark: boolean): void {
    this.isDarkTheme.set(dark);
  }

  /**
   * Loads the initial theme preference from local storage or system preference.
   * @returns True if dark theme should be active.
   */
  private loadInitialTheme(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved === 'dark') {
      return true;
    } else if (saved === 'light') {
      return false;
    }

    // Fallback to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return true;
    }
    return false;
  }
}
