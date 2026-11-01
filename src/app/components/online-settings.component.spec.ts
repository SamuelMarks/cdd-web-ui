import '@angular/compiler';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { OnlineSettingsComponent } from './online-settings.component';
import { BackendConfigService } from '../services/backend-config.service';
import { ApiService } from '../services/api.service';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ServiceEndpointOverrides } from '../models/types';

describe('OnlineSettingsComponent', () => {
  let component: OnlineSettingsComponent;
  let fixture: ComponentFixture<OnlineSettingsComponent>;
  let apiSpy: {
    login: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    loginGithub: ReturnType<typeof vi.fn>;
    getVersion: ReturnType<typeof vi.fn>;
    pingBackend: ReturnType<typeof vi.fn>;
    formatPingError: ReturnType<typeof vi.fn>;
  };
  let configSpy: {
    isOnline: import('@angular/core').WritableSignal<boolean>;
    backendUrl: import('@angular/core').WritableSignal<string | null>;
    runMode: import('@angular/core').WritableSignal<string>;
    gatewayVersion: import('@angular/core').WritableSignal<string | null>;
    serviceOverrides: import('@angular/core').WritableSignal<ServiceEndpointOverrides>;
    setOnlineMode: ReturnType<typeof vi.fn>;
    setOfflineMode: ReturnType<typeof vi.fn>;
    setRunMode: ReturnType<typeof vi.fn>;
    setServiceOverrides: ReturnType<typeof vi.fn>;
    setVersionInfo: ReturnType<typeof vi.fn>;
    setConnectionStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    apiSpy = {
      login: vi.fn(),
      register: vi.fn(),
      loginGithub: vi.fn(),
      getVersion: vi.fn().mockReturnValue(of({ gateway: '0.1.0' })),
      pingBackend: vi.fn().mockReturnValue(
        of({
          status: 'ok',
          latencyMs: 12,
          endpoint: 'http://test.com/health',
        }),
      ),
      formatPingError: vi.fn(
        (endpoint: string, err: unknown) =>
          `GET ${endpoint} -> ${err instanceof Error ? err.message : 'failed'}`,
      ),
    };

    configSpy = {
      isOnline: signal(false),
      backendUrl: signal(null),
      runMode: signal('local_cdd_ctl_wasm'),
      gatewayVersion: signal<string | null>(null),
      serviceOverrides: signal<ServiceEndpointOverrides>({}),
      setOnlineMode: vi.fn((url: string) => {
        configSpy.backendUrl.set(url);
        configSpy.isOnline.set(true);
      }),
      setOfflineMode: vi.fn(() => {
        configSpy.backendUrl.set(null);
        configSpy.isOnline.set(false);
      }),
      setRunMode: vi.fn(),
      setServiceOverrides: vi.fn(),
      setVersionInfo: vi.fn(),
      setConnectionStatus: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        OnlineSettingsComponent,
        ReactiveFormsModule,
        MatDialogModule,
        BrowserAnimationsModule,
      ],
      providers: [
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: BackendConfigService, useValue: configSpy },
        { provide: ApiService, useValue: apiSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnlineSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render url form when offline', () => {
    configSpy.isOnline.set(false);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.url-form')).toBeTruthy();
  });

  it('should render auth section and optional gateway version when online', () => {
    configSpy.isOnline.set(true);
    configSpy.backendUrl.set('http://localhost:8080');
    configSpy.gatewayVersion.set('0.2.0');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.auth-form')).toBeTruthy();
    expect(compiled.querySelector('.version-badge')?.textContent).toContain('0.2.0');
  });

  it('should call setOnlineMode, pingBackend, and probeBackendVersion on valid URL submit', () => {
    component.urlForm.setValue({ url: 'http://test.com' });
    fixture.debugElement.nativeElement
      .querySelector('form.url-form')
      .dispatchEvent(new Event('submit'));
    expect(configSpy.setOnlineMode).toHaveBeenCalledWith('http://test.com');
    expect(apiSpy.getVersion).toHaveBeenCalled();
    expect(apiSpy.pingBackend).toHaveBeenCalledWith('http://test.com');
    expect(configSpy.setVersionInfo).toHaveBeenCalledWith({ gateway: '0.1.0' });
    expect(configSpy.setConnectionStatus).toHaveBeenCalledWith('connected');
    fixture.detectChanges();
    expect(component.successMsg()).toBe('Connected! (ping: ok in 12ms)');
    expect(component.pingLog()).toEqual([]);
  });

  it('should handle getVersion failure or synchronous error gracefully on connect', () => {
    apiSpy.getVersion.mockReturnValue(throwError(() => new Error('No version endpoint')));
    component.urlForm.setValue({ url: 'http://test.com' });
    component.onSetUrl();
    expect(component.successMsg()).toBe('Connected! (ping: ok in 12ms)');

    apiSpy.getVersion.mockImplementation(() => {
      throw new Error('Sync error');
    });
    component.onSetUrl();
    expect(component.successMsg()).toBe('Connected! (ping: ok in 12ms)');
  });

  it('should show detailed diagnostic log when pingBackend fails and allow manual Ping button click', () => {
    // 1. Structured PingFailureError
    apiSpy.pingBackend.mockReturnValueOnce(
      throwError(() => ({
        message: 'Ping failed for http://test.com. Ensure the backend server is running.',
        logs: [
          'GET http://test.com/health -> HTTP 0 (Unknown Error) - Network error, connection refused, or CORS blocked',
          'GET http://test.com/api/v1/health -> HTTP 0 (Unknown Error) - Network error, connection refused, or CORS blocked',
        ],
      })),
    );
    component.urlForm.setValue({ url: 'http://test.com' });
    component.onSetUrl();
    fixture.detectChanges();

    expect(configSpy.setConnectionStatus).toHaveBeenCalledWith('error');
    expect(component.successMsg()).toBe('');
    expect(component.errorMsg()).toContain('Ping failed for http://test.com');
    expect(component.pingLog().length).toBe(2);
    const logEl = fixture.nativeElement.querySelector('pre.ping-log') as HTMLElement;
    expect(logEl).toBeTruthy();
    expect(logEl.textContent).toContain('GET http://test.com/health -> HTTP 0');

    // 2. Fallback when pingBackend throws a generic error without logs array or message
    apiSpy.pingBackend.mockReturnValueOnce(throwError(() => ({})));
    const pingBtn = fixture.nativeElement.querySelector('button.ping-btn') as HTMLButtonElement;
    pingBtn.click();
    fixture.detectChanges();
    expect(component.errorMsg()).toBe('Ping failed for http://test.com');
    expect(component.pingLog()).toEqual(['GET http://test.com/health -> failed']);

    // 3. No-op when onPingBackend is called while backendUrl is null
    configSpy.backendUrl.set(null);
    apiSpy.pingBackend.mockClear();
    component.onPingBackend();
    expect(apiSpy.pingBackend).not.toHaveBeenCalled();
  });

  it('should select preset URL, toggle URL edit when online, and save service overrides', () => {
    component.selectPresetUrl('http://localhost:8086');
    expect(component.urlForm.value.url).toBe('http://localhost:8086');

    configSpy.isOnline.set(true);
    configSpy.backendUrl.set('http://localhost:8086');
    fixture.detectChanges();

    component.toggleEditUrl();
    expect(component.showEditUrl()).toBe(true);
    expect(component.urlForm.value.url).toBe('http://localhost:8086');

    component.toggleEditUrl();
    expect(component.showEditUrl()).toBe(false);

    configSpy.backendUrl.set(null);
    component.toggleEditUrl();
    expect(component.urlForm.value.url).toBe('');
    component.toggleEditUrl();

    component.toggleAdvanced();
    expect(component.showAdvanced()).toBe(true);
    fixture.detectChanges();

    component.overridesForm.setValue({
      controlPlaneUrl: 'http://localhost:8081/api/v1',
      storageUrl: 'http://localhost:8085',
      docsUiUrl: 'http://localhost:8082',
    });
    component.onSaveOverrides();
    expect(configSpy.setServiceOverrides).toHaveBeenCalledWith({
      controlPlaneUrl: 'http://localhost:8081/api/v1',
      storageUrl: 'http://localhost:8085',
      docsUiUrl: 'http://localhost:8082',
    });
    expect(component.successMsg()).toBe('Service endpoint overrides saved.');

    component.overridesForm.setValue({
      controlPlaneUrl: '',
      storageUrl: '',
      docsUiUrl: '',
    });
    component.onSaveOverrides();
    expect(configSpy.setServiceOverrides).toHaveBeenCalledWith({
      controlPlaneUrl: null,
      storageUrl: null,
      docsUiUrl: null,
    });

    configSpy.setServiceOverrides.mockImplementation(() => {
      throw new Error('Invalid override URL');
    });
    component.onSaveOverrides();
    expect(component.errorMsg()).toBe('Invalid override URL');
  });

  it('should display error if setOnlineMode fails', () => {
    configSpy.setOnlineMode.mockImplementation(() => {
      throw new Error('Invalid URL');
    });
    component.urlForm.setValue({ url: 'invalid' });
    component.onSetUrl();
    fixture.detectChanges();
    expect(component.errorMsg()).toBe('Invalid URL');
  });

  it('should go offline', () => {
    configSpy.isOnline.set(true);
    fixture.detectChanges();
    fixture.debugElement.nativeElement.querySelector('button[color="warn"]').click();
    expect(configSpy.setOfflineMode).toHaveBeenCalled();
    fixture.detectChanges();
    expect(component.successMsg()).toBe('Now offline.');
  });

  it('should not call setOnlineMode on invalid URL submit', () => {
    component.urlForm.setValue({ url: '' });
    component.onSetUrl();
    expect(configSpy.setOnlineMode).not.toHaveBeenCalled();
  });

  it('should not call api.login on invalid form', () => {
    component.authForm.setValue({ username: '', password: '' });
    configSpy.isOnline.set(true);
    fixture.detectChanges();
    fixture.debugElement.nativeElement
      .querySelector('form.auth-form')
      .dispatchEvent(new Event('submit'));
    expect(apiSpy.login).not.toHaveBeenCalled();
  });

  it('should not call api.register on invalid form', () => {
    component.authForm.setValue({ username: '', password: '' });
    configSpy.isOnline.set(true);
    fixture.detectChanges();
    fixture.debugElement.nativeElement.querySelector('button[color="accent"]').click();
    expect(apiSpy.register).not.toHaveBeenCalled();
  });

  it('should call api.login and store token on successful login', () => {
    component.authForm.setValue({ username: 'user', password: 'password' });
    apiSpy.login.mockReturnValue(of({ token: 'test-token' }));
    component.onLogin();
    expect(apiSpy.login).toHaveBeenCalled();
    expect(localStorage.getItem('cdd_auth_token')).toBe('test-token');
    fixture.detectChanges();
    expect(component.successMsg()).toBe('Logged in successfully!');
  });

  it('should display error on login failure', () => {
    component.authForm.setValue({ username: 'user', password: 'wrong' });
    apiSpy.login.mockReturnValue(throwError(() => new Error('Error')));
    component.onLogin();
    fixture.detectChanges();
    expect(component.errorMsg()).toBe('Login failed');
  });

  it('should do nothing on login if form is invalid', () => {
    component.authForm.setValue({ username: '', password: '' });
    component.onLogin();
    expect(apiSpy.login).not.toHaveBeenCalled();
  });

  it('should call api.register and store token on successful registration', () => {
    component.authForm.setValue({ username: 'user', password: 'password' });
    apiSpy.register.mockReturnValue(of({ token: 'test-token' }));
    component.onRegister();
    expect(apiSpy.register).toHaveBeenCalledWith({
      username: 'user',
      password: 'password',
      email: 'user@example.com',
    });
    expect(localStorage.getItem('cdd_auth_token')).toBe('test-token');
    fixture.detectChanges();
    expect(component.successMsg()).toBe('Registered successfully!');

    component.authForm.setValue({ username: 'user@domain.com', password: 'password' });
    component.onRegister();
    expect(apiSpy.register).toHaveBeenLastCalledWith({
      username: 'user@domain.com',
      password: 'password',
      email: 'user@domain.com',
    });

    (component.authForm as unknown as { value: Record<string, string> }).value = {
      username: '',
      password: 'password',
    };
    component.onRegister();
    expect(apiSpy.register).toHaveBeenLastCalledWith({
      username: '',
      password: 'password',
      email: '@example.com',
    });
  });

  it('should display error on register failure', () => {
    component.authForm.setValue({ username: 'user', password: 'password' });
    apiSpy.register.mockReturnValue(throwError(() => new Error('Error')));
    component.onRegister();
    fixture.detectChanges();
    expect(component.errorMsg()).toBe('Registration failed');
  });

  it('should do nothing on register if form is invalid', () => {
    component.authForm.setValue({ username: '', password: '' });
    component.onRegister();
    expect(apiSpy.register).not.toHaveBeenCalled();
  });

  it('should handle github login success', () => {
    apiSpy.loginGithub.mockReturnValue(of({ token: 'gh-token' }));
    configSpy.isOnline.set(true);
    fixture.detectChanges();
    fixture.debugElement.nativeElement.querySelector('button.github-btn').click();
    expect(apiSpy.loginGithub).toHaveBeenCalled();
    expect(localStorage.getItem('cdd_auth_token')).toBe('gh-token');
    fixture.detectChanges();
    expect(component.successMsg()).toBe('GitHub Login successful!');
  });

  it('should handle github login failure', () => {
    apiSpy.loginGithub.mockReturnValue(throwError(() => new Error('Error')));
    component.onGithubLogin();
    fixture.detectChanges();
    expect(component.errorMsg()).toBe('GitHub OAuth flow failed. Check backend configuration.');
  });

  it('should change run mode', () => {
    component.onRunModeChange('local_cdd_ctl_native');
    expect(configSpy.setRunMode).toHaveBeenCalledWith('local_cdd_ctl_native');
    expect(component.successMsg()).toBe('Execution mode updated.');
    expect(component.errorMsg()).toBe('');
  });
});
