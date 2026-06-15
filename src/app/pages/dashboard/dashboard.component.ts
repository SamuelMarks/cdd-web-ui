import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="dashboard-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>CDD Control</h2>
        </div>
        
        <nav class="sidebar-nav">
          <a routerLink="/dashboard/organizations" routerLinkActive="active" class="nav-item">
            Organizations
          </a>
          <a routerLink="/dashboard/repositories" routerLinkActive="active" class="nav-item">
            Repositories
          </a>
          <a routerLink="/dashboard/secrets" routerLinkActive="active" class="nav-item">
            Secrets & Releases
          </a>
          <a routerLink="/dashboard/audit-logs" routerLinkActive="active" class="nav-item">
            Audit Logs
          </a>
          <a routerLink="/workspace" class="nav-item">
            Workspace Preview
          </a>
        </nav>
        
        <div class="sidebar-footer">
          @if (authService.profile(); as profile) {
            <div class="user-profile">
              @if (profile.avatarUrl) {
                <img [src]="profile.avatarUrl" [alt]="profile.name" class="avatar" />
              }
              <div class="user-info">
                <span class="user-name">{{ profile.name }}</span>
                <span class="user-email">{{ profile.email }}</span>
              </div>
            </div>
          }
          <button class="btn-logout" (click)="logout()">Log Out</button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <header class="top-bar">
          <!-- Top bar content can go here -->
        </header>
        <div class="content-area">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
  styles: `
    .dashboard-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background-color: var(--color-bg-subtle, #f5f5f5);
      font-family: system-ui, -apple-system, sans-serif;
    }

    /* Sidebar Styles */
    .sidebar {
      width: 260px;
      background-color: var(--color-bg-default, #ffffff);
      border-right: 1px solid var(--color-border-default, #d0d7de);
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--color-border-default, #d0d7de);
      h2 {
        margin: 0;
        font-size: 1.25rem;
        color: var(--color-text-default, #24292f);
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
      color: var(--color-text-default, #24292f);
      text-decoration: none;
      font-weight: 500;
      transition: background-color 0.2s, color 0.2s;

      &:hover {
        background-color: var(--color-bg-subtle, #f5f5f5);
      }

      &.active {
        background-color: var(--color-accent-subtle, #ddf4ff);
        color: var(--color-accent-emphasis, #0969da);
        border-left: 4px solid var(--color-accent-emphasis, #0969da);
        padding-left: calc(1.5rem - 4px);
      }
    }

    .sidebar-footer {
      padding: 1rem;
      border-top: 1px solid var(--color-border-default, #d0d7de);
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
      color: var(--color-text-default, #24292f);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-email {
      font-size: 0.75rem;
      color: var(--color-text-muted, #57606a);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-logout {
      width: 100%;
      padding: 0.5rem;
      background: none;
      border: 1px solid var(--color-border-default, #d0d7de);
      border-radius: 6px;
      color: var(--color-text-default, #24292f);
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s;

      &:hover {
        background-color: var(--color-bg-subtle, #f5f5f5);
      }
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
      background-color: var(--color-bg-default, #ffffff);
      border-bottom: 1px solid var(--color-border-default, #d0d7de);
      display: flex;
      align-items: center;
      padding: 0 1.5rem;
    }

    .content-area {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }
  `
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
