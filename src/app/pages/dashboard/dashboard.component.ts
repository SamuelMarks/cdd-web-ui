/**
 * Dashboard shell layout component with navigation sidebar, connected accounts management,
 * backend server status bar, and router outlet.
 * @module app/pages/dashboard/dashboard.component
 */
import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { BackendConfigService } from '../../services/backend-config.service';
import { OnlineSettingsComponent } from '../../components/online-settings.component';
import { AuthMethod, OAuthProvider } from '../../models/types';

/**
 * Component for rendering the main dashboard layout, including the sidebar,
 * connected accounts panel (GitHub, Google, Password), and top navigation.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    NgOptimizedImage,
    ReactiveFormsModule,
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

          <!-- Connected Accounts Card -->
          <section class="connected-accounts-card" aria-label="Connected Accounts">
            <h3 class="connected-title" i18n="@@dashboardConnectedAccountsTitle">
              Connected Accounts
            </h3>

            <div class="provider-row">
              <span class="provider-label">
                GitHub
                <span
                  class="provider-badge"
                  [class.linked]="authService.connectedAccounts().github"
                >
                  {{ authService.connectedAccounts().github ? 'Connected' : 'Unlinked' }}
                </span>
              </span>
              @if (authService.connectedAccounts().github) {
                <button
                  type="button"
                  class="provider-action-btn disconnect"
                  (click)="onDisconnectProvider('github')"
                  aria-label="Disconnect GitHub account"
                >
                  Disconnect
                </button>
              } @else {
                <button
                  type="button"
                  class="provider-action-btn connect"
                  (click)="onConnectProvider('github')"
                  aria-label="Connect GitHub account"
                >
                  Connect GitHub
                </button>
              }
            </div>

            <div class="provider-row">
              <span class="provider-label">
                Google
                <span
                  class="provider-badge"
                  [class.linked]="authService.connectedAccounts().google"
                >
                  {{ authService.connectedAccounts().google ? 'Connected' : 'Unlinked' }}
                </span>
              </span>
              @if (authService.connectedAccounts().google) {
                <button
                  type="button"
                  class="provider-action-btn disconnect"
                  (click)="onDisconnectProvider('google')"
                  aria-label="Disconnect Google account"
                >
                  Disconnect
                </button>
              } @else {
                <button
                  type="button"
                  class="provider-action-btn connect"
                  (click)="onConnectProvider('google')"
                  aria-label="Connect Google account"
                >
                  Connect Google
                </button>
              }
            </div>

            <div class="provider-row">
              <span class="provider-label">
                Password
                <span
                  class="provider-badge"
                  [class.linked]="authService.connectedAccounts().password"
                >
                  {{ authService.connectedAccounts().password ? 'Configured' : 'Unset' }}
                </span>
              </span>
              <button
                type="button"
                class="provider-action-btn connect"
                (click)="togglePasswordForm()"
              >
                {{
                  showPasswordForm()
                    ? 'Cancel'
                    : authService.connectedAccounts().password
                      ? 'Update Password'
                      : 'Set Password'
                }}
              </button>
            </div>

            @if (showPasswordForm()) {
              <form
                [formGroup]="passwordForm"
                (ngSubmit)="onConnectPassword()"
                class="password-connect-form"
                aria-label="Set Account Password"
              >
                <label for="dashboardNewPassword" class="sr-only">New Password</label>
                <input
                  id="dashboardNewPassword"
                  type="password"
                  formControlName="password"
                  class="password-input"
                  placeholder="Min 8 characters"
                  autocomplete="new-password"
                />
                <button
                  type="submit"
                  class="provider-action-btn connect"
                  [disabled]="passwordForm.invalid"
                >
                  Save Password
                </button>
              </form>
            }

            @if (accountMessage()) {
              <p class="account-status success" role="status" aria-live="polite">
                {{ accountMessage() }}
              </p>
            }
            @if (accountError()) {
              <p class="account-status error" role="alert">
                {{ accountError() }}
              </p>
            }
          </section>

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
      width: 280px;
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
      margin-bottom: 0.75rem;
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

    .connected-accounts-card {
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 0.65rem;
      margin-bottom: 0.75rem;
      font-size: 0.75rem;
    }

    .connected-title {
      margin: 0 0 0.5rem 0;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .provider-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.35rem;
      margin-bottom: 0.35rem;
    }

    .provider-label {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--text-primary);
      font-weight: 500;
    }

    .provider-badge {
      padding: 0.1rem 0.35rem;
      border-radius: 8px;
      font-size: 0.6875rem;
      background: var(--surface-color);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
      &.linked {
        background: var(--primary-hover);
        color: var(--primary-color);
        border-color: var(--primary-color);
      }
    }

    .provider-action-btn {
      padding: 0.2rem 0.45rem;
      border-radius: 4px;
      font-size: 0.6875rem;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border-color);
      background: var(--surface-color);
      color: var(--text-primary);
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      &.disconnect {
        color: var(--error-text);
      }
    }

    .password-connect-form {
      display: flex;
      gap: 0.35rem;
      margin-top: 0.4rem;
    }

    .password-input {
      flex: 1;
      min-width: 0;
      padding: 0.25rem 0.4rem;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 0.75rem;
      background: var(--surface-color);
      color: var(--text-primary);
    }

    .account-status {
      margin: 0.35rem 0 0;
      font-size: 0.7rem;
      &.success {
        color: var(--primary-color);
      }
      &.error {
        color: var(--error-text);
      }
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
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
  /** Reactive form builder instance. */
  private readonly fb = inject(FormBuilder);

  /** Signal controlling visibility of the password linking form. */
  readonly showPasswordForm = signal<boolean>(false);
  /** Signal holding account-linking status feedback. */
  readonly accountMessage = signal<string | null>(null);
  /** Signal holding account-linking error feedback. */
  readonly accountError = signal<string | null>(null);

  /** Form group for setting or updating a password credential on the current account. */
  readonly passwordForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /**
   * Opens the Online Settings dialog to configure or switch the backend server URL.
   */
  openBackendSettings(): void {
    this.dialog.open(OnlineSettingsComponent, { width: '440px' });
  }

  /**
   * Initiates connecting a GitHub or Google OAuth identity to the current user's account.
   * @param provider OAuth provider (`'github'` or `'google'`).
   */
  onConnectProvider(provider: OAuthProvider): void {
    this.accountError.set(null);
    this.authService.connectAccountWithProvider(provider);
    if (!this.config.isOnline()) {
      this.accountMessage.set(`${provider === 'google' ? 'Google' : 'GitHub'} account linked.`);
    }
  }

  /**
   * Disconnects an authentication provider (`github`, `google`, or `password`) from the user's account.
   * @param provider Authentication provider to disconnect.
   */
  async onDisconnectProvider(provider: AuthMethod): Promise<void> {
    this.accountError.set(null);
    this.accountMessage.set(null);
    try {
      await this.authService.disconnectProvider(provider);
      this.accountMessage.set(
        `${provider === 'google' ? 'Google' : 'GitHub'} account disconnected.`,
      );
    } catch (err) {
      const error = err as Error;
      this.accountError.set(error.message);
    }
  }

  /**
   * Toggles the inline password-setting form.
   */
  togglePasswordForm(): void {
    this.showPasswordForm.update((v) => !v);
    this.accountError.set(null);
    if (!this.showPasswordForm()) {
      this.passwordForm.reset();
    }
  }

  /**
   * Saves a new password credential on the current user's account (`POST /api/v1/auth/me/connect/password`).
   */
  async onConnectPassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      return;
    }
    this.accountError.set(null);
    this.accountMessage.set(null);
    try {
      const { password } = this.passwordForm.getRawValue();
      await this.authService.connectPassword(password);
      this.accountMessage.set('Password credential configured.');
      this.showPasswordForm.set(false);
      this.passwordForm.reset();
    } catch (err) {
      const error = err as Error;
      this.accountError.set(error.message);
    }
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
