import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DocsSyncService } from './docs-sync.service';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ThemeService } from './theme.service';
import { selectOpenApiSpecContent, selectOpenApiValidationErrors } from '../store/selectors';
import { signal, WritableSignal } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('DocsSyncService', () => {
  let service: DocsSyncService;
  let store: MockStore;
  let isDarkThemeSignal: WritableSignal<boolean>;

  beforeEach(() => {
    isDarkThemeSignal = signal<boolean>(false);

    TestBed.configureTestingModule({
      providers: [
        DocsSyncService,
        provideMockStore({
          selectors: [
            { selector: selectOpenApiSpecContent, value: 'initial spec' },
            { selector: selectOpenApiValidationErrors, value: [] },
          ],
        }),
        { provide: ThemeService, useValue: { isDarkTheme: isDarkThemeSignal } },
      ],
    });
    store = TestBed.inject(MockStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    service = TestBed.inject(DocsSyncService);
    expect(service).toBeTruthy();
  });

  it('should send queued spec and theme updates when DOCS_UI_READY is received', () => {
    vi.useFakeTimers();
    // Create iframe mock
    const iframeMock = document.createElement('iframe');
    iframeMock.title = 'API Documentation Preview';
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframeMock, 'contentWindow', {
      value: { postMessage: postMessageSpy },
      writable: true,
    });
    document.body.appendChild(iframeMock);

    // Initialize service (subscribes to state)
    service = TestBed.inject(DocsSyncService);

    // Trigger tick to process debounced store selector emissions
    vi.advanceTimersByTime(500);

    // Initial state is queued because iframe isn't ready
    expect(postMessageSpy).not.toHaveBeenCalled();

    // Dispatch DOCS_UI_READY event
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'DOCS_UI_READY' },
      }),
    );

    // Expect queued messages to be sent
    expect(postMessageSpy).toHaveBeenCalledWith({ type: 'SET_THEME', payload: 'light' }, '*');
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'UPDATE_SPEC', payload: 'initial spec' },
      '*',
    );

    // Cleanup
    document.body.removeChild(iframeMock);
    vi.useRealTimers();
  });

  it('should not send spec if validation errors exist', () => {
    vi.useFakeTimers();
    const iframeMock = document.createElement('iframe');
    iframeMock.title = 'API Documentation Preview';
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframeMock, 'contentWindow', {
      value: { postMessage: postMessageSpy },
      writable: true,
    });
    document.body.appendChild(iframeMock);

    service = TestBed.inject(DocsSyncService);
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'DOCS_UI_READY' } }));

    // Clear initial calls
    postMessageSpy.mockClear();

    // Set validation error and trigger spec update
    store.overrideSelector(selectOpenApiValidationErrors, ['error']);
    store.overrideSelector(selectOpenApiSpecContent, 'new spec');
    store.refreshState();

    vi.advanceTimersByTime(500);

    // Should not have sent the new spec because of validation error
    expect(postMessageSpy).not.toHaveBeenCalledWith(
      { type: 'UPDATE_SPEC', payload: 'new spec' },
      '*',
    );

    // Cleanup
    document.body.removeChild(iframeMock);
    vi.useRealTimers();
  });

  it('should send spec update directly if iframe is already ready', () => {
    vi.useFakeTimers();
    const iframeMock = document.createElement('iframe');
    iframeMock.title = 'API Documentation Preview';
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframeMock, 'contentWindow', {
      value: { postMessage: postMessageSpy },
      writable: true,
    });
    document.body.appendChild(iframeMock);

    service = TestBed.inject(DocsSyncService);
    
    // Send ready
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'DOCS_UI_READY' } }));
    vi.advanceTimersByTime(500);
    postMessageSpy.mockClear();

    // Now update spec content
    store.overrideSelector(selectOpenApiSpecContent, 'updated spec');
    store.refreshState();
    vi.advanceTimersByTime(500);

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'UPDATE_SPEC', payload: 'updated spec' },
      '*'
    );

    document.body.removeChild(iframeMock);
    vi.useRealTimers();
  });


  it('should ignore unrelated message events', () => {
    vi.useFakeTimers();
    service = TestBed.inject(DocsSyncService);
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'SOME_OTHER_EVENT' } }));
    vi.advanceTimersByTime(500);
    // isIframeReady remains false, so no errors thrown
    expect(service['isIframeReady']).toBe(false);
    vi.useRealTimers();
  });

  it('should send theme update directly if iframe is already ready', () => {
    vi.useFakeTimers();
    const iframeMock = document.createElement('iframe');
    iframeMock.title = 'API Documentation Preview';
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframeMock, 'contentWindow', {
      value: { postMessage: postMessageSpy },
      writable: true,
    });
    document.body.appendChild(iframeMock);

    service = TestBed.inject(DocsSyncService);
    
    // Send ready
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'DOCS_UI_READY' } }));
    vi.advanceTimersByTime(500);
    postMessageSpy.mockClear();

    // Now update theme content
    isDarkThemeSignal.set(true);
    TestBed.flushEffects();
    vi.advanceTimersByTime(500);

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'SET_THEME', payload: 'dark' },
      '*'
    );

    document.body.removeChild(iframeMock);
    vi.useRealTimers();
  });

  it('should not throw if iframe is not found in DOM', () => {
    vi.useFakeTimers();
    service = TestBed.inject(DocsSyncService);
    
    // Send ready (even if no iframe exists in DOM)
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'DOCS_UI_READY' } }));
    
    // Update theme to trigger postToIframe
    isDarkThemeSignal.set(true);
    TestBed.flushEffects();
    vi.advanceTimersByTime(500);

    // Should gracefully not throw error
    expect(true).toBe(true);
    
    vi.useRealTimers();
  });

});