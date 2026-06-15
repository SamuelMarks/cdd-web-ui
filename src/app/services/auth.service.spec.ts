import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let mockRouter: any;
  let mockDocument: any;

  beforeEach(() => {
    mockRouter = {
      navigate: vi.fn()
    };
    mockDocument = {
      location: { href: '' }
    };

    localStorage.clear();
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: DOCUMENT, useValue: mockDocument }
      ]
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

  it('should load profile if token exists in localStorage on construction', () => {
    localStorage.setItem('cdd_auth_token', 'initial-token');
    service = TestBed.inject(AuthService);

    expect(service.token()).toBe('initial-token');
    expect(service.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(500);

    expect(service.profile()).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Demo User',
      avatarUrl: 'https://github.com/identicons/demo.png'
    });
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

  it('should initiate OAuth login flow for github', () => {
    service = TestBed.inject(AuthService);
    
    service.loginWithProvider('github');

    expect(mockDocument.location.href).toBe('http://localhost:3000/auth/github');
  });

  it('should initiate OAuth login flow for google', () => {
    service = TestBed.inject(AuthService);
    
    service.loginWithProvider('google');

    expect(mockDocument.location.href).toBe('http://localhost:3000/auth/google');
  });
});
