import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { vi } from 'vitest';
import { App } from './app';
import { BackendConfigService } from './services/backend-config.service';
import { ThemeService } from './services/theme.service';

describe('App', () => {
  let configSpy: {
    isOnline: import('@angular/core').WritableSignal<boolean>;
    backendUrl: import('@angular/core').WritableSignal<string | null>;
    runMode: import('@angular/core').WritableSignal<string>;
  };
  let themeSpy: { isDarkTheme: WritableSignal<boolean>; toggleTheme: ReturnType<typeof vi.fn> };
  let isDarkThemeSignal: WritableSignal<boolean>;

  beforeEach(async () => {
    isDarkThemeSignal = signal(true);
    configSpy = {
      isOnline: signal(false),
      backendUrl: signal(null),
      runMode: signal('local'), // This ensures useGithub is false and App sets isReady to true immediately
    };

    themeSpy = {
      isDarkTheme: isDarkThemeSignal,
      toggleTheme: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: BackendConfigService, useValue: configSpy },
        { provide: ThemeService, useValue: themeSpy },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(app.title).toEqual('cdd-web-ui');
  });

  it('should render online title when config is online', () => {
    configSpy.isOnline.set(true);
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isReady.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.status-indicator')?.classList.contains('is-online')).toBe(true);
  });

  it('should render offline title when config is offline', () => {
    configSpy.isOnline.set(false);
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isReady.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.status-indicator')?.classList.contains('is-offline')).toBe(
      true,
    );
  });

  it('should call theme.toggleTheme when toggle button is clicked', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isReady.set(true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.theme-toggle');
    button.click();
    expect(themeSpy.toggleTheme).toHaveBeenCalled();
  });

  it('should open online settings dialog', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const spy = vi.spyOn(app['dialog'], 'open').mockImplementation(() => ({}) as never);

    app.openSettings();
    expect(spy).toHaveBeenCalled();
  });

  it('should render correct theme tooltip based on theme state', () => {
    themeSpy.isDarkTheme.set(false);
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isReady.set(true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button.theme-toggle');
    expect(button.textContent || '').toContain('Switch to Dark Mode');
  });
});
