import { TestBed } from '@angular/core/testing';
import { LoggingService } from './logging.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LoggingService', () => {
  let service: LoggingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoggingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should log info messages correctly', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    service.info('Test info message', { key: 'value' });
    expect(consoleSpy).toHaveBeenCalledWith('[INFO]: Test info message', { key: 'value' });
    consoleSpy.mockRestore();
  });

  it('should log warn messages correctly', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    service.warn('Test warn message');
    expect(consoleSpy).toHaveBeenCalledWith('[WARN]: Test warn message');
    consoleSpy.mockRestore();
  });

  it('should log error messages correctly', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    service.error('Test error message');
    expect(consoleSpy).toHaveBeenCalledWith('[ERROR]: Test error message');
    consoleSpy.mockRestore();
  });
});
