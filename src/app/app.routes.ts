import { Routes } from '@angular/router';

/**
 * Defines the application's routing configuration.
 * Uses lazy loading for all main feature components.
 * @module app/routes
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/editor/editor.component').then((m) => m.EditorComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'organization/:id',
    loadComponent: () =>
      import('./pages/organization/organization.component').then((m) => m.OrganizationComponent),
  },
  {
    path: 'repository/:id',
    loadComponent: () => import('./pages/editor/editor.component').then((m) => m.EditorComponent),
  },
  { path: '**', redirectTo: '' },
];
