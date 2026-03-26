import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/state';
import { selectApiDocsLoadState } from '../../store/selectors';
import * as WorkspaceActions from '../../store/actions';
import { DOCS_UI_BASE_URL } from '../../models/constants';
import { DocsSyncService } from '../../services/docs-sync.service';

/** Component for viewing API documentation. */
@Component({
  /** selector */
  selector: 'app-api-docs-viewer',
  /** standalone */
  standalone: true,
  /** imports */
  imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule, MatIconModule],
  /** changeDetection */
  changeDetection: ChangeDetectionStrategy.OnPush,
  /** template */
  template: `
    <div class="api-docs-header">
      <div class="header-title">
        <mat-icon>menu_book</mat-icon>
        <span>API Documentation Preview</span>
        <mat-icon
          class="info-icon"
          title="Note: While this studio environment requires several megabytes to run locally, the rendered API documentation (cdd-docs-ui) is highly optimized (under 100KB) and functions entirely without JavaScript."
        >
          info
        </mat-icon>
      </div>
      <div class="header-actions">
        <button mat-icon-button title="Pop out" aria-label="Pop out API Docs in a new tab" (click)="popOut()">
          <mat-icon>open_in_new</mat-icon>
        </button>
        <button mat-icon-button title="Close" aria-label="Close API Docs pane" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>

    <div class="api-docs-content">
      @if (loadState() === 'LOADING') {
        <div class="loading-overlay">
          <mat-spinner diameter="40"></mat-spinner>
          <span class="loading-text">Loading API Docs...</span>
        </div>
      }

      @if (loadState() === 'ERROR') {
        <div class="error-overlay">
          <mat-icon class="error-icon">error_outline</mat-icon>
          <span class="error-text">Failed to load API Docs.</span>
          <button mat-stroked-button color="primary" (click)="retryLoad()">Retry</button>
        </div>
      }

      <!-- The iframe is rendered even if there's an error so we can retry reloading by resetting src -->
      <iframe
        #docsIframe
        [src]="safeIframeUrl()"
        title="API Documentation Preview"
        width="100%"
        height="100%"
        frameborder="0"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups"
        (load)="onIframeLoad()"
      ></iframe>
    </div>
  `,
  /** styles */
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background: var(--surface-color, #fff);
        overflow: hidden;
      }
      .api-docs-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 40px;
        padding: 0 8px 0 16px;
        background: var(--surface-color);
        border-bottom: 1px solid var(--border-color);
      }
      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
      }
      .info-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: var(--text-secondary);
        cursor: help;
      }
      .api-docs-content {
        position: relative;
        flex: 1;
        height: 100%;
        width: 100%;
      }
      iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: none;
      }
      .loading-overlay,
      .error-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        background: var(--surface-color);
        z-index: 10;
      }
      .loading-text,
      .error-text {
        font-size: 14px;
        color: var(--text-secondary);
      }
      .error-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--error-text);
      }
    `,
  ],
})
/** ApiDocsViewerComponent */
export class ApiDocsViewerComponent implements OnInit, OnDestroy {
  /** The DOM sanitizer used to trust the iframe URL. */
  private sanitizer = inject(DomSanitizer);
  /** The NgRx store for application state. */
  private store = inject(Store<AppState>);
  /** The service responsible for syncing docs data. */
  private docsSyncService = inject(DocsSyncService);

  /** Signal containing the current loading state of the API Docs. */
  loadState = this.store.selectSignal(selectApiDocsLoadState);
  /** Signal containing the trusted URL for the iframe. */
  safeIframeUrl = signal<SafeResourceUrl>(
    this.sanitizer.bypassSecurityTrustResourceUrl(DOCS_UI_BASE_URL),
  );

  /** Reference to the timeout timer used for checking load state. */
  private loadTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Lifecycle hook called on component initialization. Starts the load timeout. */
  ngOnInit() {
    this.startLoadTimeout();
  }

  /** Lifecycle hook called on component destruction. Clears any active timeouts. */
  ngOnDestroy() {
    this.clearLoadTimeout();
  }

  /** Starts the 10-second timeout for the iframe loading state. */
  startLoadTimeout() {
    this.clearLoadTimeout();
    this.loadTimeout = setTimeout(() => {
      if (this.loadState() === 'LOADING') {
        this.store.dispatch(
          WorkspaceActions.apiDocsIframeLoadFailed({ error: 'Timeout loading API Docs iframe.' }),
        );
      }
    }, 10000); // 10s timeout
  }

  /** Clears the loading timeout if one is active. */
  clearLoadTimeout() {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
  }

  /** Event handler called when the iframe has successfully loaded. */
  onIframeLoad() {
    this.clearLoadTimeout();
    this.store.dispatch(WorkspaceActions.apiDocsIframeLoaded());
  }

  /** Retries loading the iframe by refreshing the URL and restarting the timeout. */
  retryLoad() {
    this.store.dispatch(WorkspaceActions.setApiDocsVisibility({ visible: true }));
    // Resetting safeIframeUrl to force reload of iframe if needed
    this.safeIframeUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(DOCS_UI_BASE_URL + '?retry=' + Date.now()),
    );
    this.startLoadTimeout();
  }

  /** Opens the API Docs in a new browser tab or window. */
  popOut() {
    window.open(DOCS_UI_BASE_URL, '_blank');
  }

  /** Closes the API Docs pane by dispatching a visibility action to the store. */
  close() {
    this.store.dispatch(WorkspaceActions.setApiDocsVisibility({ visible: false }));
  }
}
