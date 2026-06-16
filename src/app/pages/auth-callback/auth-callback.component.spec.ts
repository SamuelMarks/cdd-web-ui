import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthCallbackComponent } from './auth-callback.component';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AuthCallbackComponent', () => {
  let component: AuthCallbackComponent;
  let fixture: ComponentFixture<AuthCallbackComponent>;
  let mockActivatedRoute: { snapshot: { queryParamMap: { get: ReturnType<typeof vi.fn> } } };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockAuthService: { setToken: ReturnType<typeof vi.fn> };
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mockActivatedRoute = {
      snapshot: {
        queryParamMap: {
          get: vi.fn(),
        },
      },
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockAuthService = {
      setToken: vi.fn(),
    };

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [AuthCallbackComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthCallbackComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set token and navigate to /dashboard if token is present', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('fake-token');

    fixture.detectChanges(); // Triggers ngOnInit

    expect(mockAuthService.setToken).toHaveBeenCalledWith('fake-token');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should log error and navigate to /login if token is not present', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue(null);

    fixture.detectChanges(); // Triggers ngOnInit

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Authentication failed: No token received in callback',
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
