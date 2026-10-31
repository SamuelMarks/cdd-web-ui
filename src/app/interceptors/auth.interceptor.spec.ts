import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { BackendConfigService } from '../services/backend-config.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuthService: {
    token: ReturnType<typeof signal<string | null>>;
    logout: ReturnType<typeof vi.fn>;
  };
  let mockConfig: {
    backendUrl: ReturnType<typeof signal<string | null>>;
    controlPlaneUrl: ReturnType<typeof signal<string | null>>;
    storageUrl: ReturnType<typeof signal<string | null>>;
  };

  beforeEach(() => {
    mockAuthService = {
      token: signal<string | null>('jwt-123'),
      logout: vi.fn(),
    };
    mockConfig = {
      backendUrl: signal<string | null>('http://localhost:8086'),
      controlPlaneUrl: signal<string | null>('http://localhost:8081/api/v1'),
      storageUrl: signal<string | null>('http://localhost:8085'),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: BackendConfigService, useValue: mockConfig },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach Authorization header for backendUrl, controlPlaneUrl, and storageUrl requests', () => {
    http.get('http://localhost:8086/orgs').subscribe();
    const req1 = httpMock.expectOne('http://localhost:8086/orgs');
    expect(req1.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req1.flush([]);

    http.get('http://localhost:8081/api/v1/orgs').subscribe();
    const req2 = httpMock.expectOne('http://localhost:8081/api/v1/orgs');
    expect(req2.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req2.flush([]);

    http.get('http://localhost:8085/artifact/o/r/f').subscribe();
    const req3 = httpMock.expectOne('http://localhost:8085/artifact/o/r/f');
    expect(req3.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req3.flush({});
  });

  it('should not overwrite existing Authorization header or attach to external URLs', () => {
    http
      .get('http://localhost:8086/orgs', {
        headers: { Authorization: 'Bearer custom-token' },
      })
      .subscribe();
    const req1 = httpMock.expectOne('http://localhost:8086/orgs');
    expect(req1.request.headers.get('Authorization')).toBe('Bearer custom-token');
    req1.flush([]);

    http.get('https://external.example.com/spec.json').subscribe();
    const req2 = httpMock.expectOne('https://external.example.com/spec.json');
    expect(req2.request.headers.has('Authorization')).toBe(false);
    req2.flush({});
  });

  it('should not attach header when token is null', () => {
    mockAuthService.token.set(null);
    http.get('http://localhost:8086/version').subscribe();
    const req = httpMock.expectOne('http://localhost:8086/version');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should call logout on 401 response from protected backend endpoint', () => {
    let caughtError: HttpErrorResponse | undefined;
    http.get('http://localhost:8086/api/v1/orgs').subscribe({
      error: (err: HttpErrorResponse) => {
        caughtError = err;
      },
    });
    const req = httpMock.expectOne('http://localhost:8086/api/v1/orgs');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(caughtError?.status).toBe(401);
  });

  it('should not call logout on 401 from /auth/login or non-401 errors', () => {
    http.post('http://localhost:8086/auth/login', {}).subscribe({
      error: () => {},
    });
    const req1 = httpMock.expectOne('http://localhost:8086/auth/login');
    req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    expect(mockAuthService.logout).not.toHaveBeenCalled();

    http.get('http://localhost:8086/api/v1/orgs').subscribe({
      error: () => {},
    });
    const req2 = httpMock.expectOne('http://localhost:8086/api/v1/orgs');
    req2.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    expect(mockAuthService.logout).not.toHaveBeenCalled();
  });
});
