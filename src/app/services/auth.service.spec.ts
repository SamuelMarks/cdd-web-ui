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
    loginGoogle: ReturnType<typeof vi.fn>;
    getMe: ReturnType<typeof vi.fn>;
    connectGithub: ReturnType<typeof vi.fn>;
    connectGoogle: ReturnType<typeof vi.fn>;
    connectPassword: ReturnType<typeof vi.fn>;
    disconnectProvider: ReturnType<typeof vi.fn>;
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
      loginGoogle: vi.fn(),
      getMe: vi.fn().mockReturnValue(
        of({
          id: 1,
          username: 'alice',
          email: 'alice@example.com',
          github_linked: true,
          google_linked: false,
          has_password: true,
        }),
      ),
      connectGithub: vi.fn(),
      connectGoogle: vi.fn(),
      connectPassword: vi.fn(),
      disconnectProvider: vi.fn(),
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
    sessionStorage.clear();
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
    sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should be created and have initial state when no token exists', () => {
    service = TestBed.inject(AuthService);

    expect(service).toBeTruthy();
    expect(service.token()).toBeNull();
    expect(service.profile()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.connectedAccounts()).toEqual({
      github: false,
      google: false,
      password: false,
    });
  });

  it('should load profile if non-JWT token exists in localStorage on construction', () => {
    localStorage.setItem('cdd_auth_token', 'initial-token');
    service = TestBed.inject(AuthService);

    expect(service.token()).toBe('initial-token');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.connectedAccounts()).toEqual({
      github: false,
      google: false,
      password: true,
    });

    vi.advanceTimersByTime(500);

    expect(service.profile()).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Demo User',
      avatarUrl: 'https://github.com/identicons/demo.png',
      connectedAccounts: {
        github: false,
        google: false,
        password: true,
      },
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
      connectedAccounts: {
        github: false,
        google: false,
        password: true,
      },
    });

    const jwt2 = createTestJwt({ sub: '99', exp: String(futureExp), username: 'bob@example.com' });
    service.setToken(jwt2);
    expect(service.profile()?.email).toBe('bob@example.com');
  });

  it('should fetch /api/v1/auth/me in loadProfile when online and handle both success and error', () => {
    service = TestBed.inject(AuthService);
    mockConfig.isOnline.set(true);

    mockApi.getMe.mockReturnValueOnce(
      of({
        id: 7,
        username: 'carol',
        email: 'carol@example.com',
        name: 'Carol Danvers',
        avatar_url: 'https://example.com/carol.png',
        github_linked: true,
        google_linked: true,
        has_password: false,
      }),
    );
    service.setToken('online-tok');
    expect(service.profile()?.name).toBe('Carol Danvers');
    expect(service.profile()?.avatarUrl).toBe('https://example.com/carol.png');
    expect(service.connectedAccounts()).toEqual({
      github: true,
      google: true,
      password: false,
    });

    // When getMe errors out, fallback timer still runs if profile wasn't set
    service.logout();
    mockApi.getMe.mockReturnValueOnce(throwError(() => new Error('Network error')));
    service.setToken('fallback-tok');
    vi.advanceTimersByTime(500);
    expect(service.profile()?.name).toBe('Demo User');
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
    expect(sessionStorage.getItem('cdd_oauth_intent')).toBe('login:github');
    expect(mockDocument.location.href).toBe('http://localhost:3000/auth/github');

    mockConfig.backendUrl.set('http://localhost:8086');
    service.loginWithProvider('google');
    expect(sessionStorage.getItem('cdd_oauth_intent')).toBe('login:google');
    expect(mockDocument.location.href).toBe('http://localhost:8086/auth/google');
  });

  it('should authenticate via ApiService when online in login, register, loginWithEmail, completeGithubOAuth, and completeGoogleOAuth', async () => {
    service = TestBed.inject(AuthService);
    mockConfig.isOnline.set(true);
    mockApi.login.mockReturnValue(of({ token: 'online-jwt' }));
    mockApi.register.mockReturnValue(of({ token: 'reg-jwt' }));
    mockApi.loginGithub.mockReturnValue(of({ token: 'gh-jwt' }));
    mockApi.loginGoogle.mockReturnValue(of({ token: 'google-jwt' }));

    await service.loginWithEmail('alice', 'secret');
    expect(mockApi.login).toHaveBeenCalledWith({ username: 'alice', password: 'secret' });
    expect(service.token()).toBe('online-jwt');

    const regRes = await service.register('bob', 'bob@example.com', 'pass');
    expect(regRes.token).toBe('reg-jwt');
    expect(service.token()).toBe('reg-jwt');

    const ghRes = await service.completeGithubOAuth('oauth-code');
    expect(ghRes.token).toBe('gh-jwt');
    expect(service.token()).toBe('gh-jwt');

    const googleRes = await service.completeGoogleOAuth('google-code');
    expect(googleRes.token).toBe('google-jwt');
    expect(service.token()).toBe('google-jwt');

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

  it('should completeGithubOAuth and completeGoogleOAuth in offline demo mode', async () => {
    service = TestBed.inject(AuthService);
    mockConfig.isOnline.set(false);

    const ghOffline = await service.completeGithubOAuth('code-1');
    expect(ghOffline.token).toBe('mock-github-jwt-token');
    vi.advanceTimersByTime(500);
    expect(service.connectedAccounts().github).toBe(true);

    service.logout();
    const googleOffline = await service.completeGoogleOAuth('code-2');
    expect(googleOffline.token).toBe('mock-google-jwt-token');
    vi.advanceTimersByTime(500);
    expect(service.connectedAccounts().google).toBe(true);
  });

  it('should link and unlink accounts in both offline and online modes and guard sole remaining provider', async () => {
    service = TestBed.inject(AuthService);
    mockConfig.isOnline.set(false);

    // Offline connectAccountWithProvider when profile is initially null
    service.connectAccountWithProvider('github');
    expect(service.connectedAccounts().github).toBe(true);

    // Offline connectAccountWithProvider when profile already exists
    service.connectAccountWithProvider('google');
    expect(service.connectedAccounts().google).toBe(true);

    // Offline connectPassword
    await service.connectPassword('SuperSecret99');
    expect(service.connectedAccounts().password).toBe(true);

    // Offline completeAccountConnectOAuth
    const offlineLinked = await service.completeAccountConnectOAuth('github', 'offline-code');
    expect(offlineLinked.github_linked).toBe(true);

    // Offline disconnectProvider
    await service.disconnectProvider('google');
    expect(service.connectedAccounts().google).toBe(false);
    await service.disconnectProvider('github');
    expect(service.connectedAccounts().github).toBe(false);

    // Guard against disconnecting the sole remaining method (password)
    await expect(service.disconnectProvider('password')).rejects.toThrow(
      'Cannot disconnect your only remaining authentication method.',
    );

    // Also test offline completeAccountConnectOAuth, connectPassword, and disconnectProvider when profile is null
    service.logout();
    await service.completeAccountConnectOAuth('google', 'code');
    service.logout();
    await service.connectPassword('Pass12345');
    await service.completeAccountConnectOAuth('github', 'code');
    // Force profile null while keeping token to cover null-coalescing branches in disconnectProvider
    (
      service as unknown as {
        state: {
          set: (val: { token: string | null; profile: null }) => void;
        };
      }
    ).state.set({ token: 'tok', profile: null });
    await service.disconnectProvider('google');

    // Online account linking and disconnecting
    mockConfig.isOnline.set(true);
    mockConfig.backendUrl.set('http://localhost:8086');
    service.setToken('online-jwt');

    service.connectAccountWithProvider('google');
    expect(sessionStorage.getItem('cdd_oauth_intent')).toBe('connect:google');
    expect(mockDocument.location.href).toBe('http://localhost:8086/auth/google');

    mockConfig.backendUrl.set(null);
    service.connectAccountWithProvider('github');
    expect(mockDocument.location.href).toBe('http://localhost:3000/auth/github');

    mockApi.connectGithub.mockReturnValue(
      of({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        github_linked: true,
        google_linked: false,
        has_password: true,
      }),
    );
    const ghProf = await service.completeAccountConnectOAuth('github', 'gh-code');
    expect(ghProf.github_linked).toBe(true);

    mockApi.connectGoogle.mockReturnValue(
      of({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        github_linked: true,
        google_linked: true,
        has_password: true,
      }),
    );
    const googleProf = await service.completeAccountConnectOAuth('google', 'google-code');
    expect(googleProf.google_linked).toBe(true);

    mockApi.connectPassword.mockReturnValue(
      of({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        github_linked: true,
        google_linked: true,
        has_password: true,
      }),
    );
    const pwdProf = await service.connectPassword('NewPass123');
    expect(pwdProf.has_password).toBe(true);

    mockApi.disconnectProvider.mockReturnValue(
      of({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        github_linked: true,
        google_linked: false,
        has_password: true,
      }),
    );
    const discProf = await service.disconnectProvider('google');
    expect(discProf.google_linked).toBe(false);

    // Online calls when token is null (covers token ?? undefined branches)
    service.logout();
    // Temporarily set two connected accounts so disconnectProvider passes the guard while token is null
    mockApi.connectGithub.mockReturnValue(
      of({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        github_linked: true,
        google_linked: true,
        has_password: true,
      }),
    );
    await service.completeAccountConnectOAuth('github', 'gh-no-tok');
    await service.connectPassword('NoTokPass');
    await service.disconnectProvider('google');
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
