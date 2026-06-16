import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../services/auth.service';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockAuthService: { profile: ReturnType<typeof signal>; logout: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = {
      profile: signal({
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: 'http://avatar.com/test.png',
      }),
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render profile info', () => {
    const nameEl = fixture.nativeElement.querySelector('.user-name');
    expect(nameEl.textContent).toContain('Test User');
  });

  it('should call authService.logout on logout', () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });
});
