/**
 * Dashboard shell layout component with navigation sidebar and router outlet.
 * @module app/pages/dashboard/dashboard.component
 */
import { Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../services/auth.service';

/**
 * Component for rendering the main dashboard layout, including the sidebar and top navigation.
 */
@Component({
  selector: 'app-dashboard',
  imports: [NgOptimizedImage, RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule],
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
            <div class="user-profile">
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
          <button mat-stroked-button class="btn-logout" (click)="logout()" i18n="@@logOutBtn">
            Log Out
          </button>
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
          <!-- Top bar content can go here -->
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

    .btn-logout {
      width: 100%;
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
      padding: 0 1.5rem;
    }

    .content-area {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }
  `,
})
export class DashboardComponent {
  /**
   * Authentication service instance
   */
  authService = inject(AuthService);

  /**
   * Logs out the user
   */
  logout(): void {
    this.authService.logout();
  }
}
