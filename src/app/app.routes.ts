import { Routes } from '@angular/router';

/** Application routing configuration. */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/workspace/workspace.component').then((m) => m.WorkspaceComponent),
  },
  { path: '**', redirectTo: '' },
];
