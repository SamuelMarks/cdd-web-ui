import '@angular/compiler';
import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { BackendConfigService } from './backend-config.service';
import { WINDOW } from '../tokens';

describe('BackendConfigService', () => {
  let service: BackendConfigService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WINDOW,
          useValue: { location: { hostname: 'localhost', search: '' } },
        },
      ],
    });
    service = TestBed.inject(BackendConfigService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('should be created in offline mode by default', () => {
    expect(service).toBeTruthy();
    expect(service.isOnline()).toBe(false);
    expect(service.backendUrl()).toBeNull();
    expect(service.connectionStatus()).toBe('disconnected');
    expect(service.gatewayUrl()).toBeNull();
    expect(service.controlPlaneUrl()).toBeNull();
    expect(service.authBaseUrl()).toBeNull();
    expect(service.rpcUrl()).toBeNull();
    expect(service.mcpSseUrl()).toBeNull();
    expect(service.mcpMessageUrl()).toBeNull();
    expect(service.storageUrl()).toBeNull();
    expect(service.docsUiUrl()).toBeNull();
  });

  it('should set online mode with valid URL and compute service topology endpoints', () => {
    const url = 'http://localhost:8086/';
    service.setOnlineMode(url);
    expect(service.isOnline()).toBe(true);
    expect(service.backendUrl()).toBe('http://localhost:8086');
    expect(service.connectionStatus()).toBe('connected');
    expect(localStorage.getItem('cdd_backend_url')).toBe('http://localhost:8086');
    expect(service.gatewayUrl()).toBe('http://localhost:8086');
    expect(service.controlPlaneUrl()).toBe('http://localhost:8086/api/v1');
    expect(service.authBaseUrl()).toBe('http://localhost:8086/auth');
    expect(service.rpcUrl()).toBe('http://localhost:8086/rpc');
    expect(service.mcpSseUrl()).toBe('http://localhost:8086/mcp/sse');
    expect(service.mcpMessageUrl()).toBe('http://localhost:8086/mcp/message');
    expect(service.storageUrl()).toBe('http://localhost:8086/storage');
    expect(service.docsUiUrl()).toBe('http://localhost:8086/docs');
  });

  it('should preserve /api/v1 suffix if backendUrl already ends with /api/v1', () => {
    service.setOnlineMode('https://api.example.com/api/v1');
    expect(service.controlPlaneUrl()).toBe('https://api.example.com/api/v1');
  });

  it('should throw error for invalid URL or unsupported protocol', () => {
    expect(() => service.setOnlineMode('invalid-url')).toThrowError(
      'Invalid URL provided for backend config.',
    );
    expect(() => service.setOnlineMode('ftp://localhost:8080')).toThrowError(
      'Invalid URL provided for backend config.',
    );
    expect(service.isOnline()).toBe(false);
  });

  it('should toggle to offline mode and clear version state', () => {
    service.setOnlineMode('http://localhost:8080');
    service.setVersionInfo({ gateway: '0.1.0', ecosystem: { 'cdd-rust': '0.1.0' } });
    expect(service.gatewayVersion()).toBe('0.1.0');
    expect(service.ecosystemVersions()).toEqual({ 'cdd-rust': '0.1.0' });

    service.setOfflineMode();
    expect(service.isOnline()).toBe(false);
    expect(service.backendUrl()).toBeNull();
    expect(service.connectionStatus()).toBe('disconnected');
    expect(service.gatewayVersion()).toBeNull();
    expect(service.ecosystemVersions()).toEqual({});
    expect(localStorage.getItem('cdd_backend_url')).toBeNull();
  });

  it('should support setting version info with legacy version field or empty payload', () => {
    service.setVersionInfo({ version: '1.2.3' });
    expect(service.gatewayVersion()).toBe('1.2.3');
    expect(service.ecosystemVersions()).toEqual({});

    service.setVersionInfo({});
    expect(service.gatewayVersion()).toBeNull();
    expect(service.ecosystemVersions()).toEqual({});
  });

  it('should update connectionStatus via setConnectionStatus', () => {
    service.setConnectionStatus('connecting');
    expect(service.connectionStatus()).toBe('connecting');
    service.setConnectionStatus('error');
    expect(service.connectionStatus()).toBe('error');
  });

  it('should set and load service endpoint overrides', () => {
    service.setOnlineMode('http://localhost:8086');
    service.setServiceOverrides({
      controlPlaneUrl: 'http://localhost:8081/api/v1/',
      storageUrl: 'http://localhost:8085/',
      docsUiUrl: 'http://localhost:8082/',
    });
    expect(service.controlPlaneUrl()).toBe('http://localhost:8081/api/v1');
    expect(service.storageUrl()).toBe('http://localhost:8085');
    expect(service.docsUiUrl()).toBe('http://localhost:8082');

    const reloaded = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(reloaded.controlPlaneUrl()).toBe('http://localhost:8081/api/v1');
    expect(reloaded.storageUrl()).toBe('http://localhost:8085');
    expect(reloaded.docsUiUrl()).toBe('http://localhost:8082');

    service.setServiceOverrides({});
    expect(service.controlPlaneUrl()).toBe('http://localhost:8086/api/v1');
    expect(service.storageUrl()).toBe('http://localhost:8086/storage');
    expect(service.docsUiUrl()).toBe('http://localhost:8086/docs');
  });

  it('should ignore malformed or non-object service overrides in localStorage', () => {
    localStorage.setItem('cdd_service_overrides', 'not-valid-json');
    const s1 = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(s1.serviceOverrides()).toEqual({});

    localStorage.setItem('cdd_service_overrides', JSON.stringify([1, 2, 3]));
    const s2 = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(s2.serviceOverrides()).toEqual({});

    localStorage.setItem('cdd_service_overrides', JSON.stringify({ controlPlaneUrl: 123 }));
    const s3 = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(s3.serviceOverrides()).toEqual({
      controlPlaneUrl: null,
      storageUrl: null,
      docsUiUrl: null,
    });
  });

  it('should load url from query parameter ?backendUrl=... on init', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WINDOW,
          useValue: {
            location: {
              hostname: 'localhost',
              search: '?backendUrl=https%3A%2F%2Fgateway.example.com%2F',
            },
          },
        },
      ],
    });
    const s = TestBed.inject(BackendConfigService);
    expect(s.isOnline()).toBe(true);
    expect(s.backendUrl()).toBe('https://gateway.example.com');
    expect(localStorage.getItem('cdd_backend_url')).toBe('https://gateway.example.com');
  });

  it('should ignore invalid query parameter ?backendUrl=... and fall back to localStorage', () => {
    localStorage.setItem('cdd_backend_url', 'http://fallback.example.com/');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WINDOW,
          useValue: {
            location: {
              hostname: 'localhost',
              search: '?backendUrl=not-a-valid-url',
            },
          },
        },
      ],
    });
    const s = TestBed.inject(BackendConfigService);
    expect(s.backendUrl()).toBe('http://fallback.example.com');
  });

  it('should ignore query string without backendUrl param', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WINDOW,
          useValue: {
            location: {
              hostname: 'localhost',
              search: '?otherParam=1',
            },
          },
        },
      ],
    });
    const s = TestBed.inject(BackendConfigService);
    expect(s.backendUrl()).toBeNull();
  });

  it('should load url from storage on init', () => {
    localStorage.setItem('cdd_backend_url', 'http://example.com');
    const newService = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(newService.isOnline()).toBe(true);
    expect(newService.backendUrl()).toBe('http://example.com');
  });

  it('should initialize and compute isOnline correctly', () => {
    localStorage.setItem('cdd_backend_url', 'http://test.com');
    const s = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(s.backendUrl()).toBe('http://test.com');
    expect(s.isOnline()).toBe(true);
  });

  it('should return served_github if hostname is not localhost', () => {
    const spy = vi
      .spyOn(BackendConfigService.prototype, '_getHostname')
      .mockReturnValue('example.com');
    const s = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(s.runMode()).toBe('served_github');
    spy.mockRestore();
  });

  it('should return undefined hostname when WINDOW is null', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WINDOW,
          useValue: null,
        },
      ],
    });
    const s = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(s._getHostname()).toBeUndefined();
  });

  it('should return hostname from window', () => {
    const s = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(s._getHostname()).toBe('localhost');
  });

  it('should set and load run mode', () => {
    service.setRunMode('local_cdd_ctl_wasm');
    expect(service.runMode()).toBe('local_cdd_ctl_wasm');
    expect(localStorage.getItem('cdd_run_mode')).toBe('local_cdd_ctl_wasm');

    const newService = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(newService.runMode()).toBe('local_cdd_ctl_wasm');
  });

  it('should return local_relative if hostname is localhost', () => {
    const spy = vi
      .spyOn(BackendConfigService.prototype, '_getHostname')
      .mockReturnValue('localhost');
    const s = TestBed.runInInjectionContext(() => new BackendConfigService());
    expect(s.runMode()).toBe('local_relative');
    spy.mockRestore();
  });
});
