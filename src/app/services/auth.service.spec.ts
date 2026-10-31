import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiService } from './api.service';
import { BackendConfigService } from './backend-config.service';
import { GLOBAL_DATE } from '../tokens';

function createTestJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${body}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockDocument: { location: { href: string } };
  let mockApi: {
    login: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    loginGithub: ReturnType<typeof vi.fn>;
    deleteAccount: ReturnType<typeof vi.fn>;
  };
  let mockConfig: {
    isOnline: ReturnType<typeof signal<boolean>>;
    backendUrl: ReturnType<typeof signal<string | null>>;
    setOnlineMode: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRouter = {
      navigate: vi.fn(),
    };
    mockDocument = {
      location: { href: '' },
    };
    mockApi = {
      login: vi.fn(),
      register: vi.fn(),
      loginGithub: vi.fn(),
      deleteAccount: vi.fn(),
    };
    mockConfig = {
      isOnline: signal(false),
      backendUrl: signal<string | null>(null),
      setOnlineMode: vi.fn((url: string) => {
        mockConfig.backendUrl.set(url);
        mockConfig.isOnline.set(true);
      }),
    };

    localStorage.clear();
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: DOCUMENT, useValue: mockDocument },
        { provide: ApiService, useValue: mockApi },
        { provide: BackendConfigService, useValue: mockConfig },
        { provide: GLOBAL_DATE, useValue: Date },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should be created and have initial state when no token exists', () => {
    service = TestBed.inject(AuthService);

    expect(service).toBeTruthy();
    expect(service.token()).toBeNull();
    expect(service.profile()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should load profile if non-JWT token exists in localStorage on construction', () => {
    localStorage.setItem('cdd_auth_token', 'initial-token');
    service = TestBed.inject(AuthService);

    expect(service.token()).toBe('initial-token');
    expect(service.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(500);

    expect(service.profile()).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Demo User',
      avatarUrl: 'https://github.com/identicons/demo.png',
    });
  });

  it('should decode valid JWT claims immediately and populate profile with username or email', () => {
    service = TestBed.inject(AuthService);
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const jwt1 = createTestJwt({ sub: 42, exp: futureExp, username: 'alice' });
    service.setToken(jwt1);

    expect(service.profile()).toEqual({
      id: '42',
      username: 'alice',
      email: 'alice@cdd.local',
      name: 'alice',
      avatarUrl: 'https://github.com/identicons/alice.png',
    });

    const jwt2 = createTestJwt({ sub: '99', exp: String(futureExp), username: 'bob@example.com' });
    service.setToken(jwt2);
    expect(service.profile()?.email).toBe('bob@example.com');
  });

  it('should return null from decodeJwtClaims for expired, malformed, or incomplete JWTs', () => {
    service = TestBed.inject(AuthService);
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const expiredJwt = createTestJwt({ sub: 1, exp: pastExp, username: 'alice' });
    expect(service.decodeJwtClaims(expiredJwt)).toBeNull();
    expect(service.decodeJwtClaims('not-a-jwt')).toBeNull();
    expect(service.decodeJwtClaims('a.%%%invalid-base64%%%.c')).toBeNull();
    expect(service.decodeJwtClaims(`a.${btoa('123')}.c`)).toBeNull();
    expect(
      service.decodeJwtClaims(createTestJwt({ sub: 'nan', exp: 100, username: '' })),
    ).toBeNull();
    expect(
      service.decodeJwtClaims(createTestJwt({ sub: 1, exp: 'nan', username: 'a' })),
    ).toBeNull();
    expect(
      service.decodeJwtClaims(createTestJwt({ sub: 1, exp: 9999999999, username: 123 })),
    ).toBeNull();
  });

  it('should set token, update state and load profile', () => {
    service = TestBed.inject(AuthService);
    service.setToken('new-token');

    expect(localStorage.getItem('cdd_auth_token')).toBe('new-token');
    expect(service.token()).toBe('new-token');
    expect(service.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(500);

    expect(service.profile()?.name).toBe('Demo User');
  });

  it('should logout, clear session and navigate to /login', () => {
    localStorage.setItem('cdd_auth_token', 'some-token');
    service = TestBed.inject(AuthService);

    service.logout();

    expect(localStorage.getItem('cdd_auth_token')).toBeNull();
    expect(service.token()).toBeNull();
    expect(service.profile()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should initiate OAuth login flow for github and google using default or configured backendUrl', () => {
    service = TestBed.inject(AuthService);

    service.loginWithProvider('github');
    expect(mockDocument.location.href).toBe('http://localhost:3000/auth/github');

    mockConfig.backendUrl.set('http://localhost:8086');
    service.loginWithProvider('google');
    expect(mockDocument.location.href).toBe('http://localhost:8086/auth/google');
  });

  it('should authenticate via ApiService when online in login, register, loginWithEmail, and completeGithubOAuth', async () => {
    service = TestBed.inject(AuthService);
    mockConfig.isOnline.set(true);
    mockApi.login.mockReturnValue(of({ token: 'online-jwt' }));
    mockApi.register.mockReturnValue(of({ token: 'reg-jwt' }));
    mockApi.loginGithub.mockReturnValue(of({ token: 'gh-jwt' }));

    await service.loginWithEmail('alice', 'secret');
    expect(mockApi.login).toHaveBeenCalledWith({ username: 'alice', password: 'secret' });
    expect(service.token()).toBe('online-jwt');

    const regRes = await service.register('bob', 'bob@example.com', 'pass');
    expect(regRes.token).toBe('reg-jwt');
    expect(service.token()).toBe('reg-jwt');

    const ghRes = await service.completeGithubOAuth('oauth-code');
    expect(ghRes.token).toBe('gh-jwt');
    expect(service.token()).toBe('gh-jwt');

    // Test email-prefix fallback when logging in with email address
    mockApi.login
      .mockReturnValueOnce(throwError(() => new Error('401')))
      .mockReturnValueOnce(of({ token: 'fallback-jwt' }));
    const fallbackRes = await service.login('alice@example.com', 'secret');
    expect(fallbackRes.token).toBe('fallback-jwt');
    expect(mockApi.login).toHaveBeenLastCalledWith({ username: 'alice', password: 'secret' });

    // Test non-email login failure rethrows error
    mockApi.login.mockReturnValueOnce(throwError(() => new Error('401-plain')));
    await expect(service.login('plainuser', 'secret')).rejects.toThrow('401-plain');

    // Test status 0 unreachable fallback switching from :8086 to :8080 on login
    mockConfig.backendUrl.set('http://localhost:8086');
    mockApi.login
      .mockReturnValueOnce(throwError(() => ({ status: 0 })))
      .mockReturnValueOnce(of({ token: 'recovered-8080-jwt' }));
    const recRes = await service.login('alice', 'secret');
    expect(recRes.token).toBe('recovered-8080-jwt');
    expect(mockConfig.setOnlineMode).toHaveBeenCalledWith('http://localhost:8080');

    // Test status 0 unreachable when all candidates fail restores original URL (and when currentUrl is null)
    mockConfig.backendUrl.set('http://localhost:8086');
    mockApi.login.mockReturnValue(throwError(() => ({ status: 0 })));
    await expect(service.login('alice', 'secret')).rejects.toEqual({ status: 0 });
    expect(mockConfig.backendUrl()).toBe('http://localhost:8086');

    mockConfig.backendUrl.set(null);
    await expect(service.login('alice', 'secret')).rejects.toEqual({ status: 0 });

    // Test status 0 followed by non-zero error on fallback candidate
    mockConfig.backendUrl.set('http://localhost:8086');
    mockApi.login
      .mockReturnValueOnce(throwError(() => ({ status: 0 })))
      .mockReturnValueOnce(throwError(() => new Error('401-on-fallback')));
    await expect(service.login('alice', 'secret')).rejects.toThrow('401-on-fallback');
  });

  it('should register and authenticate in offline mode when backend is not connected', async () => {
    service = TestBed.inject(AuthService);
    mockConfig.isOnline.set(false);

    const regRes = await service.register('offline_alice', 'offline_alice@example.com', 'pass123');
    expect(regRes.token).toBe('mock-email-jwt-token');

    const loginPromise = service.loginWithEmail('offline_alice@example.com', 'pass123');
    vi.advanceTimersByTime(500);
    await expect(loginPromise).resolves.toBeUndefined();
  });

  it('should delete account on backend when online and logout when offline or online', async () => {
    service = TestBed.inject(AuthService);
    service.setToken('tok-1');
    mockConfig.isOnline.set(true);
    mockApi.deleteAccount.mockReturnValue(of(undefined));

    await service.deleteAccount();
    expect(mockApi.deleteAccount).toHaveBeenCalledWith('tok-1');
    expect(service.token()).toBeNull();

    // Also test when token is null while online
    mockApi.deleteAccount.mockClear();
    await service.deleteAccount();
    expect(mockApi.deleteAccount).toHaveBeenCalledWith(undefined);

    // Offline deleteAccount simply logs out
    mockConfig.isOnline.set(false);
    mockApi.deleteAccount.mockClear();
    await service.deleteAccount();
    expect(mockApi.deleteAccount).not.toHaveBeenCalled();
  });

  it('should authenticate with correct email and password when offline', async () => {
    service = TestBed.inject(AuthService);

    const promise = service.loginWithEmail('admin@example.com', 'admin');
    vi.advanceTimersByTime(500);
    await expect(promise).resolves.toBeUndefined();

    expect(service.token()).toBe('mock-email-jwt-token');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should reject with invalid email and password when offline', async () => {
    service = TestBed.inject(AuthService);

    const promise = service.loginWithEmail('wrong@example.com', 'wrong');
    vi.advanceTimersByTime(500);
    await expect(promise).rejects.toThrow('Invalid email or password');
  });
});
