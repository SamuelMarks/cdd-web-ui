import '@angular/compiler';
import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { PLATFORM_ID } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { vi } from 'vitest';

describe('ThemeService', () => {
  let service: ThemeService;
  let documentMock: Document;

  beforeEach(() => {
    documentMock = document;
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [ThemeService, { provide: DOCUMENT, useValue: documentMock }],
    });

    // Default system preference to false for tests to be deterministic
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    localStorage.clear();
    documentMock.documentElement.classList.remove('dark-theme');
  });

  it('should be created', () => {
    service = TestBed.inject(ThemeService);
    expect(service).toBeTruthy();
  });

  it('should default to light theme on non-browser platform', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: DOCUMENT, useValue: documentMock },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    service = TestBed.inject(ThemeService);
    expect(service.isDarkTheme()).toBe(false);
  });

  it('should initialize with light theme by default', () => {
    service = TestBed.inject(ThemeService);
    expect(service.isDarkTheme()).toBe(false);
  });

  it('should load dark theme from local storage', () => {
    localStorage.setItem('cdd_theme', 'dark');
    service = TestBed.inject(ThemeService);
    expect(service.isDarkTheme()).toBe(true);
  });

  it('should load light theme from local storage', () => {
    localStorage.setItem('cdd_theme', 'light');
    service = TestBed.inject(ThemeService);
    expect(service.isDarkTheme()).toBe(false);
  });

  it('should default to dark theme if system prefers dark mode and no local storage', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
      })),
    });

    service = TestBed.inject(ThemeService);
    expect(service.isDarkTheme()).toBe(true);
  });

  it('should toggle theme', () => {
    service = TestBed.inject(ThemeService);
    expect(service.isDarkTheme()).toBe(false);

    service.toggleTheme();

    expect(service.isDarkTheme()).toBe(true);
  });

  it('should set specific theme', () => {
    service = TestBed.inject(ThemeService);
    service.setTheme(true);
    expect(service.isDarkTheme()).toBe(true);

    service.setTheme(false);
    expect(service.isDarkTheme()).toBe(false);
  });

  it('should add dark-theme class when dark mode is active', () => {
    service = TestBed.inject(ThemeService);

    service.setTheme(true);
    TestBed.flushEffects();

    expect(documentMock.documentElement.classList.contains('dark-theme')).toBe(true);
    expect(localStorage.getItem('cdd_theme')).toBe('dark');
  });

  it('should remove dark-theme class when light mode is active', () => {
    localStorage.setItem('cdd_theme', 'dark');
    service = TestBed.inject(ThemeService);

    // Switch to light
    service.setTheme(false);
    TestBed.flushEffects();

    expect(documentMock.documentElement.classList.contains('dark-theme')).toBe(false);
    expect(localStorage.getItem('cdd_theme')).toBe('light');
  });

  it('should handle invalid JSON in local storage', () => {
    localStorage.setItem('cdd_theme_dark', 'invalid-json');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ThemeService] });
    const s = TestBed.inject(ThemeService);
    expect(s.isDarkTheme()).toBe(false);
  });

  it('should not throw on non-browser platform when toggling', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ThemeService, { provide: PLATFORM_ID, useValue: 'server' }],
    });
    const srv = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    srv.toggleTheme();
    TestBed.flushEffects();
    expect(srv).toBeTruthy();
  });
});
