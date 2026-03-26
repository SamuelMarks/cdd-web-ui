import { Injectable, inject, OnDestroy, ApplicationRef } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../store/state';
import { selectOpenApiSpecContent, selectOpenApiValidationErrors } from '../store/selectors';
import { ThemeService } from './theme.service';
import { filter, debounceTime, tap, Subject, takeUntil, distinctUntilChanged } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

/** Service for syncing documentation state. */
@Injectable({
  /** providedIn */
  providedIn: 'root',
})
/** DocsSyncService */
export class DocsSyncService implements OnDestroy {
  /** The NgRx store. */
  private store = inject(Store<AppState>);
  /** The application theme service. */
  private themeService = inject(ThemeService);
  /** The Angular application reference. */
  private appRef = inject(ApplicationRef);

  /** Subject to emit when the service is destroyed. */
  private destroy$ = new Subject<void>();
  /** Tracks whether the API docs iframe has signaled it is ready. */
  private isIframeReady = false;

  /** A pending OpenAPI spec update to be sent once the iframe is ready. */
  private pendingSpecUpdate: string | null = null;
  /** A pending theme update to be sent once the iframe is ready. */
  private pendingThemeUpdate: 'light' | 'dark' | null = null;

  /** Initializes the service by setting up message listeners and state sync. */
  constructor() {
    this.setupMessageListener();
    this.setupStateSync();
  }

  /** Cleans up subscriptions and event listeners. */
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('message', this.handleMessage);
  }

  /** Subscribes to window message events from the iframe. */
  private setupMessageListener() {
    window.addEventListener('message', this.handleMessage);
  }

  /** Handles incoming `postMessage` events from the iframe. */
  private handleMessage = (event: MessageEvent) => {
    // Basic origin check could go here if both are not localhost/same domain
    if (event.data?.type === 'DOCS_UI_READY') {
      this.isIframeReady = true;
      this.flushPendingUpdates();
    }
  };

  /** Flushes any pending spec or theme updates that were queued before the iframe was ready. */
  private flushPendingUpdates() {
    if (this.pendingThemeUpdate) {
      this.sendThemeUpdate(this.pendingThemeUpdate);
      this.pendingThemeUpdate = null;
    }
    if (this.pendingSpecUpdate !== null) {
      this.sendSpecUpdate(this.pendingSpecUpdate);
      this.pendingSpecUpdate = null;
    }
  }

  /** Subscribes to NgRx store for spec updates and ThemeService for theme changes. */
  private setupStateSync() {
    // Spec sync
    this.store
      .select(selectOpenApiSpecContent)
      .pipe(debounceTime(500), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((specContent) => {
        // Check if there are validation errors, if so, skip sending
        const errors = this.store.selectSignal(selectOpenApiValidationErrors)();
        if (errors && errors.length > 0) {
          return;
        }

        if (this.isIframeReady) {
          this.sendSpecUpdate(specContent);
        } else {
          this.pendingSpecUpdate = specContent;
        }
      });

    // Theme sync
    toObservable(this.themeService.isDarkTheme)
      .pipe(takeUntil(this.destroy$))
      .subscribe((isDark) => {
        const theme = isDark ? 'dark' : 'light';
        if (this.isIframeReady) {
          this.sendThemeUpdate(theme);
        } else {
          this.pendingThemeUpdate = theme;
        }
      });
  }

  /** Sends an OpenAPI spec update payload to the iframe. */
  private sendSpecUpdate(specContent: string) {
    this.postToIframe({
      type: 'UPDATE_SPEC',
      payload: specContent,
    });
  }

  /** Sends a theme update payload to the iframe. */
  private sendThemeUpdate(theme: 'light' | 'dark') {
    this.postToIframe({
      type: 'SET_THEME',
      payload: theme,
    });
  }

  /** Posts a given message to the API Docs iframe window. */
  private postToIframe(message: { type: string; payload: string }) {
    // Find the iframe and post
    const iframe = document.querySelector(
      'iframe[title="API Documentation Preview"]',
    ) as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(message, '*'); // targetOrigin could be restricted
    }
  }
}
