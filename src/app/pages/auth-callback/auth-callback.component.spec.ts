import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthCallbackComponent } from './auth-callback.component';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AuthCallbackComponent', () => {
  let component: AuthCallbackComponent;
  let fixture: ComponentFixture<AuthCallbackComponent>;
  let mockActivatedRoute: { snapshot: { queryParamMap: { get: ReturnType<typeof vi.fn> } } };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockAuthService: {
    setToken: ReturnType<typeof vi.fn>;
    completeGithubOAuth: ReturnType<typeof vi.fn>;
    completeGoogleOAuth: ReturnType<typeof vi.fn>;
    completeAccountConnectOAuth: ReturnType<typeof vi.fn>;
  };
  let mockNotifications: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    sessionStorage.clear();
    mockActivatedRoute = {
      snapshot: {
        queryParamMap: {
          get: vi.fn(),
        },
      },
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockAuthService = {
      setToken: vi.fn(),
      completeGithubOAuth: vi.fn(),
      completeGoogleOAuth: vi.fn(),
      completeAccountConnectOAuth: vi.fn(),
    };

    mockNotifications = {
      success: vi.fn(),
      error: vi.fn(),
    };

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [AuthCallbackComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotifications },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthCallbackComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    sessionStorage.clear();
    consoleErrorSpy.mockRestore();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set token and navigate to /dashboard if token is present', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockImplementation((key: string) =>
      key === 'token' ? 'fake-token' : null,
    );

    fixture.detectChanges();

    expect(mockAuthService.setToken).toHaveBeenCalledWith('fake-token');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should exchange GitHub OAuth code and navigate to /dashboard by default', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockImplementation((key: string) =>
      key === 'code' ? 'oauth-code-123' : null,
    );
    mockAuthService.completeGithubOAuth.mockResolvedValue({ token: 'jwt-from-code' });

    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockAuthService.completeGithubOAuth).toHaveBeenCalledWith('oauth-code-123');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should exchange Google OAuth code when provider=google is present', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockImplementation((key: string) => {
      if (key === 'code') return 'google-code-123';
      if (key === 'provider') return 'google';
      return null;
    });
    mockAuthService.completeGoogleOAuth.mockResolvedValue({ token: 'google-jwt' });

    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockAuthService.completeGoogleOAuth).toHaveBeenCalledWith('google-code-123');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should complete account linking for GitHub and Google when action=connect or sessionStorage intent is connect', async () => {
    sessionStorage.setItem('cdd_oauth_intent', 'connect:github');
    mockActivatedRoute.snapshot.queryParamMap.get.mockImplementation((key: string) =>
      key === 'code' ? 'connect-gh-code' : null,
    );
    mockAuthService.completeAccountConnectOAuth.mockResolvedValue({
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      github_linked: true,
      google_linked: false,
      has_password: true,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockAuthService.completeAccountConnectOAuth).toHaveBeenCalledWith(
      'github',
      'connect-gh-code',
    );
    expect(mockNotifications.success).toHaveBeenCalledWith('GitHub account connected!');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);

    // Also test Google connect via query parameters (state=connect, provider=google)
    const fixture2 = TestBed.createComponent(AuthCallbackComponent);
    mockActivatedRoute.snapshot.queryParamMap.get.mockImplementation((key: string) => {
      if (key === 'code') return 'connect-google-code';
      if (key === 'state') return 'connect';
      if (key === 'provider') return 'google';
      return null;
    });
    fixture2.detectChanges();
    await fixture2.whenStable();
    expect(mockAuthService.completeAccountConnectOAuth).toHaveBeenCalledWith(
      'google',
      'connect-google-code',
    );
    expect(mockNotifications.success).toHaveBeenCalledWith('Google account connected!');
  });

  it('should log error and navigate to /login if login OAuth code exchange fails, or /dashboard if connect fails', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockImplementation((key: string) =>
      key === 'code' ? 'bad-code' : null,
    );
    mockAuthService.completeGithubOAuth.mockRejectedValue(new Error('OAuth failure'));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);

    // Connect failure redirects back to /dashboard
    const fixture2 = TestBed.createComponent(AuthCallbackComponent);
    mockActivatedRoute.snapshot.queryParamMap.get.mockImplementation((key: string) => {
      if (key === 'code') return 'bad-connect-code';
      if (key === 'action') return 'connect';
      return null;
    });
    mockAuthService.completeAccountConnectOAuth.mockRejectedValue(new Error('Connect failure'));
    fixture2.detectChanges();
    await fixture2.whenStable();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should log error and navigate to /login if neither token nor code is present', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue(null);

    fixture.detectChanges();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Authentication failed: No token received in callback',
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
