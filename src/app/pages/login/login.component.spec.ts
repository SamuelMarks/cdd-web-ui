import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { BackendConfigService } from '../../services/backend-config.service';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: {
    loginWithProvider: ReturnType<typeof vi.fn>;
    loginWithEmail: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
  };
  let mockConfigService: {
    backendUrl: ReturnType<typeof signal<string | null>>;
    isOnline: ReturnType<typeof signal<boolean>>;
    setOnlineMode: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = {
      loginWithProvider: vi.fn(),
      loginWithEmail: vi.fn().mockResolvedValue(undefined),
      register: vi.fn().mockResolvedValue({ token: 'reg-token' }),
    };

    mockConfigService = {
      backendUrl: signal<string | null>(null),
      isOnline: signal<boolean>(false),
      setOnlineMode: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: BackendConfigService, useValue: mockConfigService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have invalid form initially', () => {
    expect(component.loginForm.valid).toBe(false);
  });

  it('should validate required fields', () => {
    const emailControl = component.loginForm.controls.email;
    const passwordControl = component.loginForm.controls.password;

    expect(emailControl.hasError('required')).toBe(true);
    expect(passwordControl.hasError('required')).toBe(true);

    emailControl.setValue('invalid-email');
    expect(emailControl.hasError('email')).toBe(true);
  });

  it('should connect to backend URL and handle invalid URL errors', () => {
    component.backendUrlForm.controls.url.setValue('http://localhost:8086');
    component.onConnectBackend();
    expect(mockConfigService.setOnlineMode).toHaveBeenCalledWith('http://localhost:8086');
    expect(component.backendStatusMessage()).toBe('Connected!');

    mockConfigService.isOnline.set(true);
    mockConfigService.backendUrl.set('http://localhost:8086');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.online-pill')?.textContent).toContain(
      'http://localhost:8086',
    );

    mockConfigService.setOnlineMode.mockImplementation(() => {
      throw new Error('Invalid URL provided for backend config.');
    });
    component.onConnectBackend();
    expect(component.errorMessage()).toBe('Invalid URL provided for backend config.');
    expect(component.backendStatusMessage()).toBeNull();

    // Empty URL does nothing
    mockConfigService.setOnlineMode.mockClear();
    component.backendUrlForm.controls.url.setValue('');
    component.onConnectBackend();
    expect(mockConfigService.setOnlineMode).not.toHaveBeenCalled();
  });

  it('should toggle register mode and call authService.register on submit', async () => {
    component.toggleRegisterMode();
    expect(component.isRegisterMode()).toBe(true);
    fixture.detectChanges();

    component.loginForm.controls.username.setValue('alice');
    component.loginForm.controls.email.setValue('alice@example.com');
    component.loginForm.controls.password.setValue('secret123');

    await component.onSubmit();
    expect(mockAuthService.register).toHaveBeenCalledWith(
      'alice',
      'alice@example.com',
      'secret123',
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);

    // Also test deriving username from email when username input is blank
    mockAuthService.register.mockClear();
    component.loginForm.controls.username.setValue('   ');
    await component.onSubmit();
    expect(mockAuthService.register).toHaveBeenCalledWith(
      'alice',
      'alice@example.com',
      'secret123',
    );
  });

  it('should not call loginWithEmail if form is invalid', async () => {
    await component.onSubmit();
    expect(mockAuthService.loginWithEmail).not.toHaveBeenCalled();
  });

  it('should call loginWithEmail, navigate on success', async () => {
    component.loginForm.controls.email.setValue('test@example.com');
    component.loginForm.controls.password.setValue('password123');

    await component.onSubmit();

    expect(mockAuthService.loginWithEmail).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.isSubmitting()).toBe(false);
  });

  it('should handle login error', async () => {
    mockAuthService.loginWithEmail.mockRejectedValue(new Error('Invalid credentials'));
    component.loginForm.controls.email.setValue('test@example.com');
    component.loginForm.controls.password.setValue('password123');

    await component.onSubmit();

    expect(component.errorMessage()).toBe('Invalid credentials');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBe(false);
  });

  it('should handle unknown login error and structured HttpErrorResponse objects', async () => {
    mockAuthService.loginWithEmail.mockRejectedValue('String error');
    component.loginForm.controls.email.setValue('test@example.com');
    component.loginForm.controls.password.setValue('password123');

    await component.onSubmit();

    expect(component.errorMessage()).toBe('An unknown error occurred during login.');
    expect(component.isSubmitting()).toBe(false);

    expect(component.extractErrorMessage({ status: 0 })).toContain(
      'Unable to reach backend server',
    );
    expect(component.extractErrorMessage({ status: 401, error: 'Unauthorized string' })).toBe(
      'Unauthorized string',
    );
    expect(
      component.extractErrorMessage({
        status: 401,
        error: { error: 'Unauthorized: Invalid credentials' },
      }),
    ).toBe('Unauthorized: Invalid credentials');
    expect(
      component.extractErrorMessage({
        status: 400,
        error: { message: 'Validation failed' },
      }),
    ).toBe('Validation failed');
    expect(
      component.extractErrorMessage({
        status: 500,
        error: {},
        message: 'Http failure response for /auth/login: 500 Internal Server Error',
      }),
    ).toBe('Http failure response for /auth/login: 500 Internal Server Error');
    expect(component.extractErrorMessage({ status: 500, error: '   ', message: '' })).toBe(
      'An unknown error occurred during login.',
    );
  });

  it('should call authService.loginWithProvider with github', () => {
    component.login('github');
    expect(mockAuthService.loginWithProvider).toHaveBeenCalledWith('github');
  });

  it('should call authService.loginWithProvider with google', () => {
    component.login('google');
    expect(mockAuthService.loginWithProvider).toHaveBeenCalledWith('google');
  });
});
