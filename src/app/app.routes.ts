import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

/** Application routing configuration. */
export const routes: Routes = [
  {
    /** path */
    path: '',
    /** loadComponent */
    loadComponent: () =>
      import('./pages/workspace/workspace.component').then((m) => m.WorkspaceComponent),
  },
  {
    /** path */
    path: 'login',
    /** loadComponent */
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    /** path */
    path: 'auth-callback',
    /** loadComponent */
    loadComponent: () =>
      import('./pages/auth-callback/auth-callback.component').then((m) => m.AuthCallbackComponent),
  },
  {
    /** path */
    path: 'dashboard',
    canActivate: [authGuard],
    /** loadComponent */
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    children: [
      { path: '', redirectTo: 'organizations', pathMatch: 'full' },
      {
        path: 'organizations',
        loadComponent: () =>
          import('./pages/dashboard/organizations/organizations.component').then(
            (m) => m.OrganizationsComponent,
          ),
      },
      {
        path: 'repositories',
        loadComponent: () =>
          import('./pages/dashboard/repositories/repositories.component').then(
            (m) => m.RepositoriesComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
