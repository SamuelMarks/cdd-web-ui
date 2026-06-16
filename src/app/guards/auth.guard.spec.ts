import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, ActivatedRouteSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('authGuard', () => {
  let mockAuthService: { isAuthenticated: ReturnType<typeof vi.fn> };
  let mockRouter: { createUrlTree: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: vi.fn(),
    };
    mockRouter = {
      createUrlTree: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('should return true if authenticated', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);

    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/protected' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(true);
  });

  it('should return UrlTree to /login if not authenticated', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    const mockUrlTree = {} as UrlTree;
    mockRouter.createUrlTree.mockReturnValue(mockUrlTree);

    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/protected' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(mockUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/protected' },
    });
  });
});
