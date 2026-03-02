import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have correct title', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('cdd-web-ui');
  });

  it('should toggle online mode and dismiss error', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.showOnlineError()).toBe(false);

    app.toggleOnlineMode();
    expect(app.showOnlineError()).toBe(true);

    // Test dismiss
    app.dismissError();
    expect(app.showOnlineError()).toBe(false);

    // Test timeout
    app.toggleOnlineMode();
    expect(app.showOnlineError()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 3100));
    expect(app.showOnlineError()).toBe(false);
  });

  it('should render header with title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('CDD Web UI (Offline)');
  });
});
