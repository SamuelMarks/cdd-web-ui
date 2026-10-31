/**
 * Dashboard shell layout component with navigation sidebar, backend server status bar, and router outlet.
 * @module app/pages/dashboard/dashboard.component
 */
import { Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { BackendConfigService } from '../../services/backend-config.service';
import { OnlineSettingsComponent } from '../../components/online-settings.component';

/**
 * Component for rendering the main dashboard layout, including the sidebar and top navigation.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    NgOptimizedImage,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatDialogModule,
  ],
  template: `
    <div class="dashboard-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2 i18n="@@dashboardSidebarTitle">CDD Control</h2>
        </div>

        <nav
          class="sidebar-nav"
          aria-label="Dashboard Navigation"
          i18n-aria-label="@@dashboardNavAria"
        >
          <a
            routerLink="/dashboard/organizations"
            routerLinkActive="active"
            class="nav-item"
            i18n="@@navOrganizations"
          >
            Organizations
          </a>
          <a
            routerLink="/dashboard/repositories"
            routerLinkActive="active"
            class="nav-item"
            i18n="@@navRepositories"
          >
            Repositories
          </a>
          <a
            routerLink="/dashboard/secrets"
            routerLinkActive="active"
            class="nav-item"
            i18n="@@navSecrets"
          >
            Secrets & Releases
          </a>
          <a
            routerLink="/dashboard/audit-logs"
            routerLinkActive="active"
            class="nav-item"
            i18n="@@navAuditLogs"
          >
            Audit Logs
          </a>
          <a routerLink="/" class="nav-item" i18n="@@navWorkspacePreview"> Workspace Preview </a>
        </nav>

        <div class="sidebar-footer">
          @if (authService.profile(); as profile) {
            <div class="user-profile" aria-label="User Profile">
              @if (profile.avatarUrl) {
                <img
                  [ngSrc]="profile.avatarUrl"
                  [alt]="profile.name"
                  width="32"
                  height="32"
                  class="avatar"
                />
              }
              <div class="user-info">
                <span class="user-name">{{ profile.name }}</span>
                <span class="user-email">{{ profile.email }}</span>
              </div>
            </div>
          }
          <div class="footer-actions">
            <button mat-stroked-button class="btn-logout" (click)="logout()" i18n="@@logOutBtn">
              Log Out
            </button>
            <button
              mat-button
              class="btn-delete-account"
              type="button"
              aria-label="Delete Account"
              (click)="onDeleteAccount()"
              i18n="@@deleteAccountBtn"
            >
              Delete Account
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <div
        class="main-content"
        role="region"
        aria-label="Dashboard Content"
        i18n-aria-label="@@dashboardContentAria"
      >
        <header class="top-bar">
          <div class="backend-indicator">
            <span class="status-dot" [class.online]="config.isOnline()"></span>
            @if (config.isOnline()) {
              <span class="backend-url-text" i18n="@@dashboardBackendUrlText">
                Backend: {{ config.backendUrl() }}
              </span>
            } @else {
              <span class="backend-url-text" i18n="@@dashboardOfflineModeText">
                Offline Demo Mode
              </span>
            }
          </div>
          <button
            mat-stroked-button
            type="button"
            class="btn-configure-backend"
            (click)="openBackendSettings()"
            i18n="@@configureBackendBtn"
          >
            Backend Settings
          </button>
        </header>
        <div class="content-area">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
  styles: `
    .dashboard-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background-color: var(--bg-color);
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
    }

    /* Sidebar Styles */
    .sidebar {
      width: 260px;
      background-color: var(--surface-color);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      h2 {
        margin: 0;
        font-size: 1.25rem;
        color: var(--text-primary);
      }
    }

    .sidebar-nav {
      flex: 1;
      padding: 1rem 0;
      overflow-y: auto;
    }

    .nav-item {
      display: block;
      padding: 0.75rem 1.5rem;
      color: var(--text-primary);
      text-decoration: none;
      font-weight: 500;
      transition:
        background-color 0.2s,
        color 0.2s;

      &:hover {
        background-color: var(--bg-color);
      }

      &.active {
        background-color: var(--primary-hover);
        color: var(--primary-color);
        border-left: 4px solid var(--primary-color);
        padding-left: calc(1.5rem - 4px);
      }
    }

    .sidebar-footer {
      padding: 1rem;
      border-top: 1px solid var(--border-color);
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }

    .user-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-email {
      font-size: 0.75rem;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .footer-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .btn-logout {
      width: 100%;
    }

    .btn-delete-account {
      width: 100%;
      color: var(--error-text);
      font-size: 0.75rem;
    }

    /* Main Content Styles */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .top-bar {
      height: 60px;
      background-color: var(--surface-color);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2rem;
    }

    .backend-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--text-secondary);
      &.online {
        background-color: #2e7d32;
      }
    }

    .content-area {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }
  `,
})
export class DashboardComponent {
  /** Authentication service instance. */
  readonly authService = inject(AuthService);
  /** Backend configuration service instance. */
  readonly config = inject(BackendConfigService);
  /** Material dialog service instance. */
  private readonly dialog = inject(MatDialog);

  /**
   * Opens the Online Settings dialog to configure or switch the backend server URL.
   */
  openBackendSettings(): void {
    this.dialog.open(OnlineSettingsComponent, { width: '440px' });
  }

  /**
   * Logs out the user.
   */
  logout(): void {
    this.authService.logout();
  }

  /**
   * Deletes the current user account and logs out.
   */
  async onDeleteAccount(): Promise<void> {
    await this.authService.deleteAccount();
  }
}
