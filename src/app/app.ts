import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BackendConfigService } from './services/backend-config.service';
import { ThemeService } from './services/theme.service';
import { OnlineSettingsComponent } from './components/online-settings.component';

/**
 * The root application component containing the overall app layout shell (Header, Main Content, Footer).
 */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  template: `
    <div class="app-layout">
      <mat-toolbar color="primary" class="app-header" role="banner">
        <div class="logo">
          <h1 i18n="@@appTitle">
            <a routerLink="/" style="color: inherit; text-decoration: none;" aria-label="Home"
              >CDD Web UI ({{ config.isOnline() ? 'Online' : 'Offline' }})</a
            >
          </h1>
        </div>
        <span class="spacer"></span>
        <nav aria-label="Main Navigation" class="nav-links">
          <button
            mat-button
            (click)="openSettings()"
            i18n="@@onlineSettings"
            aria-label="Open Online Settings"
          >
            Settings
          </button>
          <button
            mat-icon-button
            class="theme-toggle"
            (click)="theme.toggleTheme()"
            [matTooltip]="theme.isDarkTheme() ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
            [attr.aria-label]="theme.isDarkTheme() ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
          >
            <span aria-hidden="true" class="theme-icon">{{ theme.isDarkTheme() ? '☀' : '☾' }}</span>
          </button>
        </nav>
      </mat-toolbar>

      <main class="app-main" role="main">
        <router-outlet></router-outlet>
      </main>

      <footer class="app-footer" role="contentinfo">
        <p>&copy; 2026 CDD Web UI. All rights reserved.</p>
      </footer>
    </div>
  `,
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /** The application title. */
  title = 'cdd-web-ui';

  /** Backend configuration service instance. */
  readonly config = inject(BackendConfigService);
  /** Theme service instance. */
  readonly theme = inject(ThemeService);
  /** Material dialog service instance. */
  private readonly dialog = inject(MatDialog);

  /**
   * Opens the online settings dialog.
   */
  openSettings(): void {
    this.dialog.open(OnlineSettingsComponent, { width: '400px' });
  }
}
