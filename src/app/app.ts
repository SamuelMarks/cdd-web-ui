import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

/**
 * The root application component.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule],
  template: `
    <mat-toolbar color="primary" class="app-header" role="banner">
      <div class="logo">
        <h1 i18n="@@appTitle">
          <a routerLink="/" style="color: white; text-decoration: none;" aria-label="Home"
            >CDD Web UI (Offline)</a
          >
        </h1>
      </div>
      <span class="spacer"></span>
      <nav aria-label="Main Navigation">
        <a mat-button routerLink="/dashboard" i18n="@@dashboardLink" aria-label="Go to Dashboard"
          >Dashboard</a
        >
        <button
          mat-stroked-button
          (click)="toggleOnlineMode()"
          i18n="@@goOnline"
          aria-label="Attempt to go online"
        >
          Go Online
        </button>
      </nav>
    </mat-toolbar>

    @if (showOnlineError()) {
      <div class="alert alert-warning" role="alert" aria-live="assertive">
        <p i18n="@@onlineModeComingSoon">Online mode coming soon!</p>
        <button
          type="button"
          class="close-btn"
          (click)="dismissError()"
          aria-label="Close error"
          i18n-aria-label="@@closeError"
        >
          ×
        </button>
      </div>
    }

    <main class="app-main" role="main">
      <router-outlet></router-outlet>
    </main>
  `,
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /** The application title. */
  title = 'cdd-web-ui';

  /** Signal to track if the online error should be shown. */
  readonly showOnlineError = signal(false);

  /**
   * Toggles the online mode error banner.
   */
  toggleOnlineMode(): void {
    this.showOnlineError.set(true);
    setTimeout(() => this.showOnlineError.set(false), 3000);
  }

  /**
   * Dismisses the online mode error banner.
   */
  dismissError(): void {
    this.showOnlineError.set(false);
  }
}
