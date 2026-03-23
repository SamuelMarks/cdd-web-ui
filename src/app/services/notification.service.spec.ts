import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('NotificationService', () => {
  let service: NotificationService;
  let snackBarMock: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    snackBarMock = {
      open: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: MatSnackBar, useValue: snackBarMock },
      ],
    });
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should display success notification', () => {
    service.success('Success message');
    expect(snackBarMock.open).toHaveBeenCalledWith('Success message', 'Close', {
      duration: 3000,
      panelClass: ['toast-success'],
    });
  });

  it('should display error notification', () => {
    service.error('Error message');
    expect(snackBarMock.open).toHaveBeenCalledWith('Error message', 'Close', {
      duration: 5000,
      panelClass: ['toast-error'],
    });
  });

  it('should display info notification', () => {
    service.info('Info message');
    expect(snackBarMock.open).toHaveBeenCalledWith('Info message', 'Close', {
      duration: 3000,
      panelClass: ['toast-info'],
    });
  });
});
