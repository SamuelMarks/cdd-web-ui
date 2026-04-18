import { Injectable, signal } from '@angular/core';

/** Represents a single log entry */
export interface LogEntry {
  /** Severity level */
  level: 'INFO' | 'WARN' | 'ERROR';
  /** Log message */
  message: string;
  /** ISO timestamp */
  timestamp: string;
  /** Optional parameters */
  params?: unknown[];
}

/**
 * Service to handle unified logging across the frontend.
 */
@Injectable({
  providedIn: 'root',
})
export class LoggingService {
  /** doc */
  private logsSignal = signal<LogEntry[]>([]);
  /** doc */
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

  /** doc */
  clear(): void {
    this.logsSignal.set([]);
  }

  /** doc */
  private addLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, params: unknown[]): void {
    this.logsSignal.update((logs) => [
      ...logs,
      { level, message, timestamp: new Date().toISOString(), params },
    ]);
  }
}
