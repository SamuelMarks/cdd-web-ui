import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/angular';
import { bootstrap } from './main';

// Mock the bootstrapApplication so it doesn't actually try to start the app in tests
vi.mock('@angular/platform-browser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angular/platform-browser')>();
  return {
    ...actual,
    bootstrapApplication: vi.fn().mockReturnValue(Promise.reject(new Error('Test error'))),
  };
});

describe('Main Bootstrap', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Sentry, 'init').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call bootstrap function with real DSN', async () => {
    // Calling it directly to ensure code is covered
    const result = bootstrap('https://real-dsn@o0.ingest.sentry.io/0');
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined(); // It catches the error
    expect(console.error).toHaveBeenCalled();
  });

  it('should call bootstrap function without Sentry', () => {
    // Calling it directly to ensure code is covered
    const result = bootstrap('https://placeholder-dsn@o0.ingest.sentry.io/0');
    expect(result).toBeInstanceOf(Promise);
  });

  it('should call bootstrap function with default parameter', () => {
    // Calling it directly to ensure code is covered (default parameter)
    const result = bootstrap();
    expect(result).toBeInstanceOf(Promise);
  });
});
