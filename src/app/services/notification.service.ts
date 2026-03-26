import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Service to display toast notifications using Angular Material SnackBar.
 */
@Injectable({
  providedIn: 'root',
})
/** NotificationService */
export class NotificationService {
  /** MatSnackBar instance. */
  private readonly snackBar = inject(MatSnackBar);

  /**
   * Displays a success notification.
   * @param message The message to display.
   */
  success(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['toast-success'],
    });
  }

  /**
   * Displays an error notification.
   * @param message The message to display.
   */
  error(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['toast-error'],
    });
  }

  /**
   * Displays an info notification.
   * @param message The message to display.
   */
  info(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['toast-info'],
    });
  }
}
