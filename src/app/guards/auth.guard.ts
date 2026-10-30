/**
 * Route guard for authenticated dashboard pages.
 * @module app/guards/auth.guard
 */
import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Authentication guard to protect routes that require user login.
 *
 * @param route The activated route snapshot.
 * @param state The router state snapshot.
 * @returns true if the user is authenticated, otherwise a UrlTree redirecting to login.
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Not authenticated, redirect to login page with the return url
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
