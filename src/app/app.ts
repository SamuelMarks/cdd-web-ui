import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  isDevMode,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { BackendConfigService } from './services/backend-config.service';
import { ThemeService } from './services/theme.service';
import { OnlineSettingsComponent } from './components/online-settings.component';
import { WasmLoadDialogComponent } from './components/wasm-load-dialog/wasm-load-dialog.component';

/**
 * The root application component containing the overall app layout shell (Header, Main Content, Footer).
 */
@Component({
  selector: 'app-root',
  /** imports */
  imports: [
    NgOptimizedImage,
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatDialogModule,
    MatTooltipModule,
    MatIconModule,
  ],
  /** template */
  template: `
    @if (isReady()) {
      <div class="app-layout">
        @if (config.runMode() === 'local_relative') {
          <div
            class="local-mode-toolbar"
            role="status"
            aria-live="polite"
            i18n="@@localModeToolbar"
          >
            Local Mode
          </div>
        }
        <mat-toolbar color="primary" class="app-header" role="banner">
          <div class="logo">
            <mat-icon class="app-logo-icon" aria-hidden="true">code</mat-icon>
            <h1 i18n="@@appTitle">
              <a
                routerLink="/"
                style="color: inherit; text-decoration: none;"
                aria-label="Home"
                i18n-aria-label="@@homeLinkAria"
                >CDD (WASM) web UI</a
              >
            </h1>
            @if (config.isOnline()) {
              <div
                class="status-indicator is-online"
                matTooltip="Connected (Online)"
                i18n-matTooltip="@@statusOnlineTooltip"
                aria-label="System is online"
                i18n-aria-label="@@statusOnlineAria"
                role="status"
                aria-live="polite"
              ></div>
            } @else {
              <div
                class="status-indicator is-offline"
                matTooltip="Disconnected (Offline)"
                i18n-matTooltip="@@statusOfflineTooltip"
                aria-label="System is offline"
                i18n-aria-label="@@statusOfflineAria"
                role="status"
                aria-live="polite"
              ></div>
            }
          </div>
          <span class="spacer"></span>
          <nav aria-label="Main Navigation" i18n-aria-label="@@mainNavAria" class="nav-links">
            <a
              mat-icon-button
              href="https://github.com/SamuelMarks/cdd-ctl#readme"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Documentation"
              matTooltip="Documentation"
              i18n-matTooltip="@@documentationTooltip"
            >
              <mat-icon>help_outline</mat-icon>
            </a>
            <button
              mat-icon-button
              (click)="openSettings()"
              aria-label="Settings"
              matTooltip="Settings"
              i18n-matTooltip="@@onlineSettings"
            >
              <mat-icon>settings</mat-icon>
            </button>
            <a
              href="https://github.com/SamuelMarks/cdd-ctl"
              target="_blank"
              rel="noopener noreferrer"
              class="github-link header-github-link"
              aria-label="View cdd-ctl on GitHub"
              matTooltip="View cdd-ctl on GitHub"
            >
              <img ngSrc="/assets/icons/github.svg" alt="" width="24" height="24" />
            </a>
            <button mat-icon-button class="theme-toggle" (click)="theme.toggleTheme()">
              @if (theme.isDarkTheme()) {
                <span class="cdk-visually-hidden" i18n="@@switchToLightModeAria"
                  >Switch to Light Mode</span
                >
                <span
                  aria-hidden="true"
                  class="theme-icon"
                  matTooltip="Switch to Light Mode"
                  i18n-matTooltip="@@switchToLightMode"
                  >☀</span
                >
              } @else {
                <span class="cdk-visually-hidden" i18n="@@switchToDarkModeAria"
                  >Switch to Dark Mode</span
                >
                <span
                  aria-hidden="true"
                  class="theme-icon"
                  matTooltip="Switch to Dark Mode"
                  i18n-matTooltip="@@switchToDarkMode"
                  >☾</span
                >
              }
            </button>
          </nav>
        </mat-toolbar>

        <main class="app-main" role="main">
          <router-outlet></router-outlet>
        </main>

        <footer class="app-footer" role="contentinfo">
          <div class="footer-left">
            <span i18n="@@footerCopyright"
              >&copy; 2026 Compiler Driven Development (CDD) WASM web demo.</span
            >
            <span class="footer-divider">|</span>
            <span class="footer-version">v{{ appVersion }}</span>
          </div>
          <div class="footer-right">
            <a
              href="https://github.com/SamuelMarks/cdd-web-ui/issues"
              target="_blank"
              rel="noopener noreferrer"
              class="footer-text-link"
              i18n="@@reportIssue"
            >
              Report an Issue
            </a>
            <a
              href="https://github.com/SamuelMarks/cdd-web-ui"
              target="_blank"
              rel="noopener noreferrer"
              class="github-badge"
              aria-label="Star cdd-web-ui on GitHub"
              i18n-aria-label="@@starOnGithubAria"
            >
              <img ngSrc="/assets/icons/github.svg" alt="" width="16" height="16" />
              <span i18n="@@starOnGithub">Star us on GitHub</span>
            </a>
          </div>
        </footer>
      </div>
    }
  `,
  /** styleUrl */
  styleUrl: './app.css',
  /** changeDetection */
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** App */
export class App implements OnInit {
  /** The application title. */
  title = 'cdd-web-ui';
  /** The current application version. */
  readonly appVersion = '0.0.1';

  /** Backend configuration service instance. */
  readonly config = inject(BackendConfigService);
  /** Theme service instance. */
  readonly theme = inject(ThemeService);
  /** Material dialog service instance. */
  private readonly dialog = inject(MatDialog);

  /** Whether the application is ready to render its main UI. */
  readonly isReady = signal(false);

  /**
   * Initializes the application.
   * Shows the WASM load dialog, and sets the app as ready when it closes successfully.
   */
  ngOnInit(): void {
    // Show the dialog first, do not render main UI until it closes with success.
    // This happens regardless of the environment (local or production) for replication purposes.
    const dialogRef = this.dialog.open(WasmLoadDialogComponent, {
      width: '400px',
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe(() => {
      this.isReady.set(true);
    });
  }

  /**
   * Opens the online settings dialog.
   */
  openSettings(): void {
    this.dialog.open(OnlineSettingsComponent, { width: '400px' });
  }
}
