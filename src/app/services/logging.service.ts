import { Injectable } from '@angular/core';

/**
 * Service to handle unified logging across the frontend.
 */
@Injectable({
  providedIn: 'root',
})
export class LoggingService {
  /**
   * Logs an informational message.
   * @param message The message to log.
   * @param optionalParams Additional parameters to log.
   */
  info(message: string, ...optionalParams: unknown[]): void {
    console.info(`[INFO]: ${message}`, ...optionalParams);
  }

  /**
   * Logs a warning message.
   * @param message The message to log.
   * @param optionalParams Additional parameters to log.
   */
  warn(message: string, ...optionalParams: unknown[]): void {
    console.warn(`[WARN]: ${message}`, ...optionalParams);
  }

  /**
   * Logs an error message.
   * @param message The message to log.
   * @param optionalParams Additional parameters to log.
   */
  error(message: string, ...optionalParams: unknown[]): void {
    console.error(`[ERROR]: ${message}`, ...optionalParams);
  }
}
