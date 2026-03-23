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

describe('OnlineSettingsComponent', () => {
  let component: OnlineSettingsComponent;
  let fixture: ComponentFixture<OnlineSettingsComponent>;
  let apiSpy: {
    login: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    loginGithub: ReturnType<typeof vi.fn>;
  };
  let configSpy: {
    isOnline: import('@angular/core').WritableSignal<boolean>;
    backendUrl: import('@angular/core').WritableSignal<string | null>;
    setOnlineMode: ReturnType<typeof vi.fn>;
    setOfflineMode: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    apiSpy = {
      login: vi.fn(),
      register: vi.fn(),
      loginGithub: vi.fn(),
    };

    configSpy = {
      isOnline: signal(false),
      backendUrl: signal(null),
      setOnlineMode: vi.fn(),
      setOfflineMode: vi.fn(),
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

  it('should render auth section when online', () => {
    configSpy.isOnline.set(true);
    configSpy.backendUrl.set('http://localhost:8080');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.auth-form')).toBeTruthy();
  });

  it('should call setOnlineMode on valid URL submit', () => {
    component.urlForm.setValue({ url: 'http://test.com' });
    fixture.debugElement.nativeElement
      .querySelector('form.url-form')
      .dispatchEvent(new Event('submit'));
    expect(configSpy.setOnlineMode).toHaveBeenCalledWith('http://test.com');
    fixture.detectChanges();
    expect(component.successMsg()).toBe('Connected!');
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
    expect(localStorage.getItem('cdd_token')).toBe('test-token');
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
    expect(apiSpy.register).toHaveBeenCalled();
    expect(localStorage.getItem('cdd_token')).toBe('test-token');
    fixture.detectChanges();
    expect(component.successMsg()).toBe('Registered successfully!');
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
    expect(localStorage.getItem('cdd_token')).toBe('gh-token');
    fixture.detectChanges();
    expect(component.successMsg()).toBe('GitHub Login successful!');
  });

  it('should handle github login failure', () => {
    apiSpy.loginGithub.mockReturnValue(throwError(() => new Error('Error')));
    component.onGithubLogin();
    fixture.detectChanges();
    expect(component.errorMsg()).toBe('GitHub OAuth flow failed. Check backend configuration.');
  });
});
