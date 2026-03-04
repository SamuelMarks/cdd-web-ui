import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
  };
  let themeSpy: { isDarkTheme: WritableSignal<boolean>; toggleTheme: ReturnType<typeof vi.fn> };
  let isDarkThemeSignal: WritableSignal<boolean>;

  beforeEach(async () => {
    isDarkThemeSignal = signal(true);
    configSpy = {
      isOnline: signal(false),
      backendUrl: signal(null),
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
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('CDD Web UI (Online)');
  });

  it('should render offline title when config is offline', () => {
    configSpy.isOnline.set(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('CDD Web UI (Offline)');
  });

  it('should call theme.toggleTheme when toggle button is clicked', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[mat-icon-button]');
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
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button.theme-toggle');
    expect(button.getAttribute('aria-label')).toContain('Switch to Dark Mode');
  });
});
