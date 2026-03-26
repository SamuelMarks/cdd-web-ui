import { Injectable, signal } from '@angular/core';

export interface LogEntry {
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
  params?: unknown[];
}

/**
 * Service to handle unified logging across the frontend.
 */
@Injectable({
  providedIn: 'root',
})
export class LoggingService {
  private logsSignal = signal<LogEntry[]>([]);
  public readonly logs = this.logsSignal.asReadonly();

  /**
   * Logs an informational message.
   * @param message The message to log.
   * @param optionalParams Additional parameters to log.
   */
  info(message: string, ...optionalParams: unknown[]): void {
    console.info(`[INFO]: ${message}`, ...optionalParams);
    this.addLog('INFO', message, optionalParams);
  }

  /**
   * Logs a warning message.
   * @param message The message to log.
   * @param optionalParams Additional parameters to log.
   */
  warn(message: string, ...optionalParams: unknown[]): void {
    console.warn(`[WARN]: ${message}`, ...optionalParams);
    this.addLog('WARN', message, optionalParams);
  }

  /**
   * Logs an error message.
   * @param message The message to log.
   * @param optionalParams Additional parameters to log.
   */
  error(message: string, ...optionalParams: unknown[]): void {
    console.error(`[ERROR]: ${message}`, ...optionalParams);
    this.addLog('ERROR', message, optionalParams);
  }

  clear(): void {
    this.logsSignal.set([]);
  }

  private addLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, params: unknown[]): void {
    this.logsSignal.update(logs => [...logs, { level, message, timestamp: new Date().toISOString(), params }]);
  }
}
