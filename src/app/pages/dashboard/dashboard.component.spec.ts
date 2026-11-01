import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../services/auth.service';
import { BackendConfigService } from '../../services/backend-config.service';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ConnectedAccounts } from '../../models/types';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockAuthService: {
    profile: ReturnType<typeof signal>;
    connectedAccounts: ReturnType<typeof signal<ConnectedAccounts>>;
    connectAccountWithProvider: ReturnType<typeof vi.fn>;
    connectPassword: ReturnType<typeof vi.fn>;
    disconnectProvider: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    deleteAccount: ReturnType<typeof vi.fn>;
  };
  let mockConfigService: {
    isOnline: ReturnType<typeof signal<boolean>>;
    backendUrl: ReturnType<typeof signal<string | null>>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = {
      profile: signal({
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: 'http://avatar.com/test.png',
      }),
      connectedAccounts: signal<ConnectedAccounts>({
        github: false,
        google: false,
        password: true,
      }),
      connectAccountWithProvider: vi.fn((provider: 'github' | 'google') => {
        mockAuthService.connectedAccounts.update((c) => ({ ...c, [provider]: true }));
      }),
      connectPassword: vi.fn().mockImplementation(() => {
        mockAuthService.connectedAccounts.update((c) => ({ ...c, password: true }));
        return Promise.resolve(undefined);
      }),
      disconnectProvider: vi.fn().mockImplementation((provider: 'github' | 'google') => {
        mockAuthService.connectedAccounts.update((c) => ({ ...c, [provider]: false }));
        return Promise.resolve(undefined);
      }),
      logout: vi.fn(),
      deleteAccount: vi.fn().mockResolvedValue(undefined),
    };
    mockConfigService = {
      isOnline: signal(false),
      backendUrl: signal<string | null>(null),
    };
    mockDialog = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: BackendConfigService, useValue: mockConfigService },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render profile info and backend URL status', () => {
    const nameEl = fixture.nativeElement.querySelector('.user-name');
    expect(nameEl.textContent).toContain('Test User');
    expect(fixture.nativeElement.querySelector('.backend-url-text').textContent).toContain(
      'Offline Demo Mode',
    );

    mockConfigService.isOnline.set(true);
    mockConfigService.backendUrl.set('http://localhost:8086');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.backend-url-text').textContent).toContain(
      'http://localhost:8086',
    );
  });

  it('should open backend settings dialog when openBackendSettings is called', () => {
    const dialogSpy = vi.spyOn((component as unknown as { dialog: MatDialog }).dialog, 'open');
    dialogSpy.mockImplementation(() => ({}) as never);
    component.openBackendSettings();
    expect(dialogSpy).toHaveBeenCalled();
  });

  it('should connect and disconnect GitHub, Google, and Password accounts in DashboardComponent', async () => {
    // Offline connect GitHub and Google sets accountMessage
    component.onConnectProvider('github');
    expect(mockAuthService.connectAccountWithProvider).toHaveBeenCalledWith('github');
    expect(component.accountMessage()).toBe('GitHub account linked.');

    component.onConnectProvider('google');
    expect(mockAuthService.connectAccountWithProvider).toHaveBeenCalledWith('google');
    expect(component.accountMessage()).toBe('Google account linked.');

    // Online connect does not set immediate offline message
    mockConfigService.isOnline.set(true);
    component.accountMessage.set(null);
    component.onConnectProvider('github');
    expect(component.accountMessage()).toBeNull();

    // Disconnect GitHub and Google
    await component.onDisconnectProvider('github');
    expect(mockAuthService.disconnectProvider).toHaveBeenCalledWith('github');
    expect(component.accountMessage()).toBe('GitHub account disconnected.');

    await component.onDisconnectProvider('google');
    expect(mockAuthService.disconnectProvider).toHaveBeenCalledWith('google');
    expect(component.accountMessage()).toBe('Google account disconnected.');

    // Disconnect failure displays accountError
    mockAuthService.disconnectProvider.mockRejectedValueOnce(
      new Error('Cannot disconnect your only remaining authentication method.'),
    );
    await component.onDisconnectProvider('github');
    expect(component.accountError()).toBe(
      'Cannot disconnect your only remaining authentication method.',
    );

    // Toggle password form open and closed
    component.togglePasswordForm();
    expect(component.showPasswordForm()).toBe(true);
    component.togglePasswordForm();
    expect(component.showPasswordForm()).toBe(false);

    // Invalid password form does nothing
    component.togglePasswordForm();
    component.passwordForm.controls.password.setValue('short');
    await component.onConnectPassword();
    expect(mockAuthService.connectPassword).not.toHaveBeenCalled();

    // Valid password form links password
    component.passwordForm.controls.password.setValue('ValidPass123');
    await component.onConnectPassword();
    expect(mockAuthService.connectPassword).toHaveBeenCalledWith('ValidPass123');
    expect(component.accountMessage()).toBe('Password credential configured.');
    expect(component.showPasswordForm()).toBe(false);

    // Password connect error displays accountError
    component.togglePasswordForm();
    component.passwordForm.controls.password.setValue('ValidPass123');
    mockAuthService.connectPassword.mockRejectedValueOnce(new Error('Password update failed'));
    await component.onConnectPassword();
    expect(component.accountError()).toBe('Password update failed');
  });

  it('should call authService.logout on logout and deleteAccount on onDeleteAccount', async () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();

    await component.onDeleteAccount();
    expect(mockAuthService.deleteAccount).toHaveBeenCalled();
  });
});
