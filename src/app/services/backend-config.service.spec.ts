import '@angular/compiler';
import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { BackendConfigService } from './backend-config.service';

describe('BackendConfigService', () => {
  let service: BackendConfigService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(BackendConfigService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created in offline mode by default', () => {
    expect(service).toBeTruthy();
    expect(service.isOnline()).toBe(false);
    expect(service.backendUrl()).toBeNull();
  });

  it('should set online mode with valid URL', () => {
    const url = 'http://localhost:8080';
    service.setOnlineMode(url);
    expect(service.isOnline()).toBe(true);
    expect(service.backendUrl()).toBe(url);
    expect(localStorage.getItem('cdd_backend_url')).toBe(url);
  });

  it('should throw error for invalid URL', () => {
    expect(() => service.setOnlineMode('invalid-url')).toThrowError(
      'Invalid URL provided for backend config.',
    );
    expect(service.isOnline()).toBe(false);
  });

  it('should toggle to offline mode', () => {
    service.setOnlineMode('http://localhost:8080');
    service.setOfflineMode();
    expect(service.isOnline()).toBe(false);
    expect(service.backendUrl()).toBeNull();
    expect(localStorage.getItem('cdd_backend_url')).toBeNull();
  });

  it('should load url from storage on init', () => {
    localStorage.setItem('cdd_backend_url', 'http://example.com');
    const newService = new BackendConfigService();
    expect(newService.isOnline()).toBe(true);
    expect(newService.backendUrl()).toBe('http://example.com');
  });

  it('should initialize and compute isOnline correctly', () => {
    localStorage.setItem('cdd_backend_url', 'http://test.com');
    const s = new BackendConfigService();
    expect(s.backendUrl()).toBe('http://test.com');
    expect(s.isOnline()).toBe(true);
  });
});
