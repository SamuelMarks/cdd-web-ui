import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
  inject,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OpenApiParser } from './openapi-parser.util';
import * as yaml from 'js-yaml';
import { NotificationService } from '../../services/notification.service';
import { ThemeService } from '../../services/theme.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Editor component for viewing and modifying OpenAPI specifications.
 * Provides YAML/JSON validation, syntax highlighting, and formatting tools.
 */
@Component({
  selector: 'app-openapi-editor',
  /** imports */
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MonacoEditorModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
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
            <mat-icon>format_align_left</mat-icon>
          </button>
          <button
            mat-icon-button
            (click)="copyToClipboard()"
            matTooltip="Copy to Clipboard"
            i18n-matTooltip="@@copyToClipboardTooltip"
            aria-label="Copy to Clipboard"
            i18n-aria-label="@@copyToClipboardAria"
          >
            <mat-icon>content_copy</mat-icon>
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
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
        <ngx-monaco-editor
          [options]="editorOptions()"
          [formControl]="contentControl"
          (onInit)="onEditorInit($event)"
        ></ngx-monaco-editor>

        @if (validationErrors().length > 0) {
          <div class="error-overlay" role="alert">
            <strong>Validation Errors:</strong>
            <ul>
              @for (error of validationErrors(); track error) {
                <li>{{ error }}</li>
              }
            </ul>
          </div>
        }
      </div>
    </div>
  `,
  /** styleUrl */
  styleUrl: './openapi-editor.component.css',
  /** changeDetection */
  changeDetection: ChangeDetectionStrategy.OnPush,
  /** host */
  host: {
    '(document:keydown.control.s)': 'handleKeydown($event)',
    '(document:keydown.meta.s)': 'handleKeydown($event)',
  },
})
/** OpenApiEditorComponent */
export class OpenApiEditorComponent {
  /** The current OpenAPI specification content provided by the parent. */
  specContent = input.required<string>();

  /** Indicates if WASM generation is active. */
  isExecuting = input<boolean>(false);

  /** Emitted when the Generate Code button is clicked via shortcut. */
  runClicked = output<void>();

  /** Emitted when the content changes inside the editor. */
  specContentChange = output<string>();

  /** Emitted when the validation status/errors change. */
  validationErrorsChange = output<string[]>();

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
    wordWrap: 'on',
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
   * Handles global keyboard events for the component.
   * @param event The emitted keyboard event.
   */
  handleKeydown(event: Event) {
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
      const parsed = isJson ? JSON.parse(content) : yaml.load(content);

      const formatted = isJson
        ? JSON.stringify(parsed, null, 2)
        : yaml.dump(parsed, { indent: 2, lineWidth: -1 });
      this.onContentChange(formatted);
      this.notificationService.success('Document formatted successfully.');
    } catch (e) {
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
    } catch (e) {
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
