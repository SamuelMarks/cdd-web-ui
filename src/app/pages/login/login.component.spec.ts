import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: {
    loginWithProvider: ReturnType<typeof vi.fn>;
    loginWithEmail: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = {
      loginWithProvider: vi.fn(),
      loginWithEmail: vi.fn().mockResolvedValue(undefined),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
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

  it('should handle unknown login error', async () => {
    mockAuthService.loginWithEmail.mockRejectedValue('String error');
    component.loginForm.controls.email.setValue('test@example.com');
    component.loginForm.controls.password.setValue('password123');

    await component.onSubmit();

    expect(component.errorMessage()).toBe('An unknown error occurred during login.');
    expect(component.isSubmitting()).toBe(false);
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
