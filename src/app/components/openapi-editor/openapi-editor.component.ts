/**
 * OpenAPI specification editor and multi-URL fetcher component.
 * @module app/components/openapi-editor/openapi-editor.component
 */
import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  inject,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OpenApiParser } from './openapi-parser.util';
import { OpenApiInputMode, OpenApiUrlEntry } from '../../models/types';
import * as yaml from 'js-yaml';
import { NotificationService } from '../../services/notification.service';
import { ThemeService } from '../../services/theme.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Editor component for viewing and modifying OpenAPI specifications.
 * Provides a tabbed interface for direct YAML/JSON editing or specifying one or more remote OpenAPI URLs.
 */
@Component({
  selector: 'app-openapi-editor',
  /** imports */
  imports: [
    ReactiveFormsModule,
    MonacoEditorModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  /** schemas */
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  /** template */
  template: `
    <div class="openapi-editor-container">
      <div
        class="toolbar"
        role="toolbar"
        aria-label="OpenAPI Editor Actions"
        i18n-aria-label="@@openapiEditorActionsAria"
      >
        <h2 class="toolbar-title" i18n>OpenAPI Spec</h2>
      </div>

      <mat-tab-group
        class="openapi-tabs"
        [selectedIndex]="selectedTabIndex()"
        (selectedIndexChange)="onTabIndexChange($event)"
        aria-label="OpenAPI Input Source Tabs"
        i18n-aria-label="@@openapiInputSourceTabsAria"
      >
        <mat-tab label="Editor" i18n-label="@@openapiEditorTab">
          <div class="editor-wrapper">
            <div class="editor-floating-actions">
              <button
                mat-icon-button
                (click)="formatDocument()"
                matTooltip="Format Document"
                i18n-matTooltip="@@formatDocTooltip"
                aria-label="Format Document"
                i18n-aria-label="@@formatDocAria"
              >
                <mat-icon aria-hidden="true">format_align_left</mat-icon>
              </button>
              <button
                mat-icon-button
                (click)="copyToClipboard()"
                matTooltip="Copy to Clipboard"
                i18n-matTooltip="@@copyToClipboardTooltip"
                aria-label="Copy to Clipboard"
                i18n-aria-label="@@copyToClipboardAria"
              >
                <mat-icon aria-hidden="true">content_copy</mat-icon>
              </button>
              <button
                mat-icon-button
                (click)="clearEditor()"
                color="warn"
                matTooltip="Clear Editor"
                i18n-matTooltip="@@clearEditorTooltip"
                aria-label="Clear Editor"
                i18n-aria-label="@@clearEditorAria"
              >
                <mat-icon aria-hidden="true">delete_outline</mat-icon>
              </button>
            </div>
            <ngx-monaco-editor
              [options]="editorOptions()"
              [formControl]="contentControl"
              (onInit)="onEditorInit($event)"
            ></ngx-monaco-editor>

            @if (validationErrors().length > 0) {
              <div class="error-overlay" role="alert">
                <strong i18n="@@validationErrorsHeading">Validation Errors:</strong>
                <ul>
                  @for (error of validationErrors(); track error) {
                    <li>{{ error }}</li>
                  }
                </ul>
              </div>
            }
          </div>
        </mat-tab>

        <mat-tab label="URLs" i18n-label="@@openapiUrlsTab">
          <div class="urls-tab-container">
            <div
              class="urls-toolbar"
              role="toolbar"
              aria-label="OpenAPI URL Actions"
              i18n-aria-label="@@openapiUrlActionsAria"
            >
              <button
                mat-stroked-button
                type="button"
                class="add-url-btn"
                (click)="onAddUrl()"
                aria-label="Add OpenAPI URL"
                i18n-aria-label="@@addOpenApiUrlAria"
              >
                <mat-icon aria-hidden="true">add_link</mat-icon>
                <span i18n="@@addUrlBtn">Add URL</span>
              </button>

              <button
                mat-flat-button
                color="primary"
                type="button"
                class="fetch-all-urls-btn"
                [disabled]="isFetchingUrls() || !hasNonEmptyUrls()"
                (click)="onFetchAllUrls()"
                aria-label="Fetch All OpenAPI URLs"
                i18n-aria-label="@@fetchAllOpenApiUrlsAria"
              >
                <mat-icon aria-hidden="true">cloud_download</mat-icon>
                <span i18n="@@fetchAllUrlsBtn">Fetch All</span>
              </button>

              @if (hasLoadedUrls()) {
                <button
                  mat-stroked-button
                  type="button"
                  class="preview-merged-btn"
                  (click)="onPreviewInEditor()"
                  aria-label="Preview Merged Spec in Editor"
                  i18n-aria-label="@@previewMergedInEditorAria"
                >
                  <mat-icon aria-hidden="true">visibility</mat-icon>
                  <span i18n="@@previewInEditorBtn">View in Editor</span>
                </button>
              }

              <button
                mat-icon-button
                color="warn"
                type="button"
                class="clear-urls-btn"
                [disabled]="specUrls().length === 0"
                (click)="onClearUrls()"
                matTooltip="Clear All URLs"
                i18n-matTooltip="@@clearAllUrlsTooltip"
                aria-label="Clear All OpenAPI URLs"
                i18n-aria-label="@@clearAllUrlsAria"
              >
                <mat-icon aria-hidden="true">delete_sweep</mat-icon>
              </button>
            </div>

            <div class="urls-list" role="list" aria-label="OpenAPI Specification URLs">
              @for (entry of specUrls(); track entry.id; let i = $index) {
                <div class="url-entry-card" role="listitem">
                  <div class="url-entry-row">
                    <span class="url-index-badge" aria-hidden="true">#{{ i + 1 }}</span>

                    <mat-form-field
                      appearance="outline"
                      class="url-input-field"
                      subscriptSizing="dynamic"
                    >
                      <mat-label i18n="@@openApiUrlFieldLabel">OpenAPI Spec URL</mat-label>
                      <input
                        matInput
                        type="url"
                        [value]="entry.url"
                        placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
                        i18n-placeholder="@@openApiUrlPlaceholder"
                        [attr.aria-label]="'OpenAPI URL #' + (i + 1)"
                        (input)="onUrlInput(entry.id, $event)"
                        (paste)="onUrlPaste(entry.id, $event)"
                        (keydown.enter)="onUrlEnterKey(entry.id, $event)"
                      />
                    </mat-form-field>

                    <div class="url-status-indicator" role="status" aria-live="polite">
                      @switch (entry.status) {
                        @case ('loading') {
                          <mat-spinner
                            diameter="20"
                            aria-label="Fetching OpenAPI URL"
                            i18n-aria-label="@@fetchingUrlSpinnerAria"
                          ></mat-spinner>
                        }
                        @case ('loaded') {
                          <mat-icon
                            class="status-icon status-loaded"
                            matTooltip="Specification loaded"
                            i18n-matTooltip="@@urlLoadedTooltip"
                            aria-label="Specification loaded"
                            i18n-aria-label="@@urlLoadedAria"
                            >check_circle</mat-icon
                          >
                        }
                        @case ('error') {
                          <mat-icon
                            class="status-icon status-error"
                            [matTooltip]="entry.error || 'Failed to load URL'"
                            aria-label="Specification failed to load"
                            i18n-aria-label="@@urlErrorAria"
                            >error_outline</mat-icon
                          >
                        }
                        @default {
                          <mat-icon
                            class="status-icon status-idle"
                            aria-hidden="true"
                            matTooltip="Ready to fetch"
                            i18n-matTooltip="@@urlIdleTooltip"
                            >link</mat-icon
                          >
                        }
                      }
                    </div>

                    <button
                      mat-icon-button
                      type="button"
                      [disabled]="entry.status === 'loading' || !entry.url.trim()"
                      (click)="onFetchSingleUrl(entry.id)"
                      matTooltip="Fetch URL"
                      i18n-matTooltip="@@fetchSingleUrlTooltip"
                      [attr.aria-label]="'Fetch OpenAPI URL #' + (i + 1)"
                    >
                      <mat-icon aria-hidden="true">refresh</mat-icon>
                    </button>

                    <button
                      mat-icon-button
                      color="warn"
                      type="button"
                      (click)="onRemoveUrl(entry.id)"
                      matTooltip="Remove URL"
                      i18n-matTooltip="@@removeUrlTooltip"
                      [attr.aria-label]="'Remove OpenAPI URL #' + (i + 1)"
                    >
                      <mat-icon aria-hidden="true">close</mat-icon>
                    </button>
                  </div>

                  @if (entry.error) {
                    <div class="url-entry-error" role="alert">
                      {{ entry.error }}
                    </div>
                  }
                </div>
              } @empty {
                <div class="urls-empty-state">
                  <p i18n="@@noOpenApiUrlsConfigured">
                    No remote OpenAPI URLs configured. Add one or more URLs to fetch and combine
                    specifications.
                  </p>
                  <button
                    mat-stroked-button
                    type="button"
                    (click)="onAddUrl('https://petstore3.swagger.io/api/v3/openapi.json')"
                    aria-label="Add Example Petstore URL"
                    i18n-aria-label="@@addExamplePetstoreUrlAria"
                  >
                    <mat-icon aria-hidden="true">add</mat-icon>
                    <span i18n="@@addPetstoreUrlBtn">Add Petstore Example URL</span>
                  </button>
                </div>
              }
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  /** styleUrl */
  styleUrl: './openapi-editor.component.css',
})
/** OpenApiEditorComponent */
export class OpenApiEditorComponent {
  /** The current OpenAPI specification content provided by the parent. */
  specContent = input.required<string>();

  /** Indicates if WASM generation is active. */
  isExecuting = input<boolean>(false);

  /** The currently active input mode tab ('editor' or 'urls'). */
  activeMode = input<OpenApiInputMode>('editor');

  /** The list of remote OpenAPI specification URL entries. */
  specUrls = input<OpenApiUrlEntry[]>([]);

  /** Indicates whether remote OpenAPI URLs are currently being fetched. */
  isFetchingUrls = input<boolean>(false);

  /** Emitted when the Generate Code button is clicked via shortcut. */
  runClicked = output<void>();

  /** Emitted when the content changes inside the editor. */
  specContentChange = output<string>();

  /** Emitted when the validation status/errors change. */
  validationErrorsChange = output<string[]>();

  /** Emitted when the user switches between the Editor and URLs tabs. */
  activeModeChange = output<OpenApiInputMode>();

  /** Emitted when the user adds a new URL entry (optionally pre-filled). */
  urlAdded = output<string | undefined>();

  /** Emitted when a URL entry's value is modified. */
  urlUpdated = output<{
    /** ID of the modified URL entry. */
    id: string;
    /** Updated URL string. */
    url: string;
  }>();

  /** Emitted when a URL entry is removed by ID. */
  urlRemoved = output<string>();

  /** Emitted when the user clears all URL entries. */
  urlsClearClicked = output<void>();

  /** Emitted when the user triggers fetching for all or specific URL entry IDs. */
  fetchUrlsClicked = output<string[] | undefined>();

  /** Internal content state bound to the Monaco editor. */
  internalContent = signal('');

  /** Current validation errors. */
  validationErrors = signal<string[]>([]);

  /** Form control for the Monaco editor. */
  contentControl = new FormControl('');

  /** The theme service for matching Monaco theme to app theme. */
  private themeService = inject(ThemeService);
  /** Notification service for user feedback. */
  private notificationService = inject(NotificationService);

  /** Monaco editor instance reference. */
  private editorInstance: unknown;

  /** Computed selected tab index (0 for editor, 1 for urls). */
  selectedTabIndex = computed<number>(() => (this.activeMode() === 'urls' ? 1 : 0));

  /** Computed flag indicating if at least one non-empty URL exists. */
  hasNonEmptyUrls = computed<boolean>(() =>
    this.specUrls().some((entry) => entry.url.trim().length > 0),
  );

  /** Computed flag indicating if at least one URL has been successfully loaded. */
  hasLoadedUrls = computed<boolean>(() =>
    this.specUrls().some((entry) => entry.status === 'loaded' && Boolean(entry.content)),
  );

  /** Computed options for the Monaco editor. */
  editorOptions = computed(() => ({
    /** theme */
    theme: this.themeService.isDarkTheme() ? 'vs-dark' : 'vs',
    /** language */
    language: this.determineLanguage(this.internalContent()),
    /** automaticLayout */
    automaticLayout: true,
    /** minimap */
    minimap: { enabled: false },
    /** scrollBeyondLastLine */
    scrollBeyondLastLine: false,
    /** wordWrap */
    wordWrap: 'on' as const,
    /** formatOnType */
    formatOnType: true,
    /** formatOnPaste */
    formatOnPaste: true,
  }));

  /** Effect to sync the external input to the internal signal and form control when it changes from outside. */
  constructor() {
    /** Subscribe to form control changes */
    this.contentControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const content = value || '';
      if (content !== this.internalContent()) {
        this.internalContent.set(content);
        this.specContentChange.emit(content);
        this.validateContent(content);
      }
    });

    /** effect */
    effect(() => {
      const externalContent = this.specContent();
      // Only update internal if it's actually different to prevent cursor jumping
      if (this.internalContent() !== externalContent) {
        this.internalContent.set(externalContent);
        this.contentControl.setValue(externalContent, { emitEvent: false });
        this.validateContent(externalContent);
      }
    });
  }

  /**
   * Handles tab index changes from MatTabGroup and emits the corresponding OpenApiInputMode.
   * @param index The newly selected tab index (0 = 'editor', 1 = 'urls').
   */
  onTabIndexChange(index: number): void {
    const mode: OpenApiInputMode = index === 1 ? 'urls' : 'editor';
    this.activeModeChange.emit(mode);
    if (mode === 'editor') {
      this.refreshEditorLayout();
    }
  }

  /**
   * Triggers a layout recalculation on the Monaco editor if it has a layout method.
   */
  private refreshEditorLayout(): void {
    const instance = this.editorInstance as
      | {
          /** Recalculates Monaco editor dimensions. */
          layout?: () => void;
        }
      | null
      | undefined;
    if (instance && typeof instance.layout === 'function') {
      instance.layout();
    }
  }

  /**
   * Emits an event to add a new URL row.
   * @param initialUrl Optional initial URL string.
   */
  onAddUrl(initialUrl?: string): void {
    this.urlAdded.emit(initialUrl);
  }

  /**
   * Handles user typing in a URL input field.
   * @param id The ID of the URL entry being edited.
   * @param event The DOM input event.
   */
  onUrlInput(id: string, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const value = target?.value ?? '';
    this.urlUpdated.emit({ id, url: value });
  }

  /**
   * Handles multi-line paste events in a URL input field, splitting newline-delimited URLs into separate entries.
   * @param id The ID of the target URL entry.
   * @param event The clipboard paste event.
   */
  onUrlPaste(id: string, event: ClipboardEvent): void {
    const pastedText = event.clipboardData?.getData('text') ?? '';
    if (!pastedText.includes('\n') && !pastedText.includes('\r')) {
      return;
    }

    const lines = pastedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length <= 1) {
      return;
    }

    event.preventDefault();
    this.urlUpdated.emit({ id, url: lines[0] });
    for (let i = 1; i < lines.length; i++) {
      this.urlAdded.emit(lines[i]);
    }
  }

  /**
   * Handles pressing Enter inside a URL input field to immediately fetch that URL.
   * @param id The ID of the URL entry.
   * @param event The keyboard event.
   */
  onUrlEnterKey(id: string, event: Event): void {
    event.preventDefault();
    this.onFetchSingleUrl(id);
  }

  /**
   * Emits an event to remove a specific URL entry.
   * @param id The ID of the URL entry to remove.
   */
  onRemoveUrl(id: string): void {
    this.urlRemoved.emit(id);
  }

  /**
   * Emits an event to clear all URL entries.
   */
  onClearUrls(): void {
    this.urlsClearClicked.emit();
  }

  /**
   * Emits an event to fetch a single URL entry by ID.
   * @param id The ID of the URL entry to fetch.
   */
  onFetchSingleUrl(id: string): void {
    this.fetchUrlsClicked.emit([id]);
  }

  /**
   * Emits an event to fetch and merge all configured URL entries.
   */
  onFetchAllUrls(): void {
    this.fetchUrlsClicked.emit(undefined);
  }

  /**
   * Switches back to the Editor tab so the user can view or edit the merged OpenAPI specification.
   */
  onPreviewInEditor(): void {
    this.activeModeChange.emit('editor');
    this.refreshEditorLayout();
  }

  /**
   * Handles global keyboard events for the component.
   * @param event The emitted keyboard event.
   */
  handleKeydown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 's' || keyboardEvent.key === 'S') {
      if (!keyboardEvent.shiftKey) {
        keyboardEvent.preventDefault();
        if (!this.isExecuting()) {
          this.runClicked.emit();
        }
      }
    }
  }

  /**
   * Called when the Monaco editor initializes.
   * @param editor The monaco editor instance.
   */
  onEditorInit(editor: unknown): void {
    this.editorInstance = editor;
  }

  /**
   * Called when the user types in the editor or programmatically changing content.
   * @param content The new content.
   */
  onContentChange(content: string): void {
    this.internalContent.set(content);
    this.contentControl.setValue(content, { emitEvent: false });
    this.specContentChange.emit(content);
    this.validateContent(content);
  }

  /**
   * Validates the content and updates the validation errors signal.
   * @param content The content to validate.
   */
  private validateContent(content: string): void {
    const result = OpenApiParser.parseAndValidate(content);
    this.validationErrors.set(result.errors);
    this.validationErrorsChange.emit(result.errors);
  }

  /**
   * Formats the document using js-yaml or JSON stringify based on content type.
   */
  formatDocument(): void {
    const content = this.internalContent();
    if (!content.trim()) return;

    try {
      const isJson = content.trim().startsWith('{');
      const parsed: unknown = isJson ? JSON.parse(content) : yaml.load(content);

      const formatted = isJson
        ? JSON.stringify(parsed, null, 2)
        : yaml.dump(parsed, { indent: 2, lineWidth: -1 });
      this.onContentChange(formatted);
      this.notificationService.success('Document formatted successfully.');
    } catch {
      this.notificationService.error('Cannot format invalid document.');
    }
  }

  /**
   * Copies the current editor content to the clipboard.
   */
  async copyToClipboard(): Promise<void> {
    const content = this.internalContent();
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      this.notificationService.success('Copied to clipboard.');
    } catch {
      this.notificationService.error('Failed to copy to clipboard.');
    }
  }

  /**
   * Clears the editor content.
   */
  clearEditor(): void {
    this.onContentChange('');
  }

  /**
   * Determines if the content is JSON or YAML for syntax highlighting.
   * @param content The content string.
   * @returns 'json' or 'yaml'
   */
  private determineLanguage(content: string): string {
    return content.trim().startsWith('{') ? 'json' : 'yaml';
  }
}
