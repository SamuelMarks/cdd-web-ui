import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../services/auth.service';
import { BackendConfigService } from '../../services/backend-config.service';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockAuthService: {
    profile: ReturnType<typeof signal>;
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

  it('should call authService.logout on logout and deleteAccount on onDeleteAccount', async () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();

    await component.onDeleteAccount();
    expect(mockAuthService.deleteAccount).toHaveBeenCalled();
  });
});
