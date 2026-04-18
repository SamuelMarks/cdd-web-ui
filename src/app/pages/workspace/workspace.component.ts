import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  OnDestroy,
  computed,
  signal,
} from '@angular/core';
import { fromEvent, Subject, takeUntil, tap } from 'rxjs';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/state';
import * as Actions from '../../store/actions';
import * as Selectors from '../../store/selectors';
import { Target, LanguageOptions, InputFormat } from '../../models/types';
import { PETSTORE_SPEC, HELLO_WORLD_SPEC } from '../../models/examples';

import { SplitPaneComponent } from '../../components/split-pane/split-pane.component';
import { OpenApiEditorComponent } from '../../components/openapi-editor/openapi-editor.component';
import { DirectoryTreeComponent } from '../../components/directory-tree/directory-tree.component';
import { CodeViewerComponent } from '../../components/code-viewer/code-viewer.component';
import { LanguageSelectorComponent } from '../../components/language-selector/language-selector.component';
import { BottomPanelComponent } from '../../components/bottom-panel/bottom-panel.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * The main workspace component that hosts the OpenAPI editor, language selector, and code viewer.
 */
@Component({
  selector: 'app-workspace',
  /** imports */
  imports: [
    NgOptimizedImage,
    CommonModule,
    SplitPaneComponent,
    OpenApiEditorComponent,
    DirectoryTreeComponent,
    CodeViewerComponent,
    LanguageSelectorComponent,
    BottomPanelComponent,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  /** template */
  template: `
    <div class="workspace-container">
      <div class="workspace-toolbar" role="toolbar" aria-label="Workspace Tools">
        <div class="input-controls">
          <mat-form-field appearance="outline" class="toolbar-field" subscriptSizing="dynamic">
            <mat-label>Input Format</mat-label>
            <mat-select
              [value]="inputFormat() || 'openapi_3_2_0'"
              (selectionChange)="onInputFormatChange($event.value)"
            >
              <mat-select-trigger>
                <div class="format-option-trigger">
                  <img
                    [ngSrc]="
                      inputFormat() === 'google_discovery'
                        ? '/assets/icons/google.svg'
                        : '/assets/icons/openapi.svg'
                    "
                    width="20"
                    height="20"
                    alt=""
                    class="format-icon"
                  />
                  <span class="format-name">
                    {{
                      inputFormat() === 'google_discovery'
                        ? 'Google Discovery'
                        : inputFormat() === 'openapi_older'
                          ? 'Swagger / OpenAPI < 3.2.0'
                          : 'OpenAPI 3.2.0'
                    }}
                  </span>
                </div>
              </mat-select-trigger>
              <mat-option value="openapi_3_2_0">
                <div class="format-option">
                  <img
                    ngSrc="/assets/icons/openapi.svg"
                    width="20"
                    height="20"
                    alt=""
                    class="format-icon"
                  />
                  <span class="format-name">OpenAPI 3.2.0</span>
                </div>
              </mat-option>
              <mat-option value="openapi_older">
                <div class="format-option">
                  <img
                    ngSrc="/assets/icons/openapi.svg"
                    width="20"
                    height="20"
                    alt=""
                    class="format-icon"
                  />
                  <span class="format-name">Swagger / OpenAPI &lt; 3.2.0</span>
                </div>
              </mat-option>
              <mat-option value="google_discovery">
                <div class="format-option">
                  <img
                    ngSrc="/assets/icons/google.svg"
                    width="20"
                    height="20"
                    alt=""
                    class="format-icon"
                  />
                  <span class="format-name">Google Discovery</span>
                </div>
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field
            appearance="outline"
            class="toolbar-field example-field"
            subscriptSizing="dynamic"
          >
            <mat-label>Example</mat-label>
            <mat-select
              [value]="selectedExample()"
              (selectionChange)="onExampleChange($event.value)"
            >
              <mat-option value="petstore">Petstore</mat-option>
              <mat-option value="hello">Hello World</mat-option>
              <mat-option value="custom" [disabled]="true">Custom</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="arrow-container">
          <mat-icon class="flow-arrow">arrow_forward</mat-icon>
        </div>

        <div class="output-controls">
          <app-language-selector
            [selectedLanguageId]="selectedLanguageId() || ''"
            [target]="target()"
            [options]="languageOptions()"
            (languageChanged)="onLanguageChanged($event)"
            (targetChanged)="onTargetChanged($event)"
            (optionsChanged)="onOptionsChanged($event)"
          ></app-language-selector>
        </div>
      </div>

      <div class="workspace-content">
        <div class="top-pane">
          <app-split-pane
            [orientation]="orientation()"
            [isExecuting]="isExecuting()"
            [leftTemplate]="orientation() === 'openapi-left' ? openApiTemplate : codeDirTemplate"
            [rightTemplate]="orientation() === 'openapi-right' ? openApiTemplate : codeDirTemplate"
            (swapClicked)="onSwap()"
            (runClicked)="onRun()"
          ></app-split-pane>
        </div>

        <div
          class="vertical-resizer"
          tabindex="0"
          role="separator"
          aria-orientation="horizontal"
          (mousedown)="onResizerMouseDown($event)"
          (dblclick)="onResizerDoubleClick()"
          (keydown)="onResizerKeydown($event)"
        ></div>
        <div class="bottom-pane" id="bottom-pane" [style.height.px]="apiDocsPaneHeight()">
          <app-bottom-panel></app-bottom-panel>
        </div>
      </div>
    </div>

    <ng-template #openApiTemplate>
      <app-openapi-editor
        [specContent]="specContent() || ''"
        [isExecuting]="isExecuting()"
        (specContentChange)="onSpecContentChange($event)"
        (validationErrorsChange)="onValidationErrorsChange($event)"
        (runClicked)="onRun()"
      ></app-openapi-editor>
    </ng-template>

    <ng-template #codeDirTemplate>
      <div class="code-directory-wrapper">
        <div class="directory-tree-pane">
          <app-directory-tree
            [files]="generatedFiles()"
            [activeFilePath]="activeFilePath()"
            [isExecuting]="isExecuting()"
            (fileSelected)="onFileSelected($event)"
          ></app-directory-tree>
        </div>
        <div class="code-viewer-pane">
          <app-code-viewer
            [activeFilePath]="activeFilePath()"
            [fileContent]="activeFileContent()"
            (fileSelected)="onFileSelected($event)"
          ></app-code-viewer>
        </div>
      </div>
    </ng-template>
  `,
  /** styleUrl */
  styleUrl: './workspace.component.css',
  /** changeDetection */
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** WorkspaceComponent */
export class WorkspaceComponent implements OnInit, OnDestroy {
  /** document */
  private document = inject(DOCUMENT);
  /** destroy$ */
  private destroy$ = new Subject<void>();

  /** The injected NgRx store instance. */
  private store = inject(Store<AppState>);

  /** Signal for bottom pane height. Using the existing state selector. */
  apiDocsPaneHeight = this.store.selectSignal(Selectors.selectApiDocsPaneHeight);

  /** Selects the current orientation of the split pane. */
  /** Signal for workspace layout orientation. */
  orientation = this.store.selectSignal(Selectors.selectOrientation);
  /** Indicates whether a generation task is currently executing. */
  /** Signal for execution state. */
  isExecuting = this.store.selectSignal(Selectors.selectIsExecuting);
  /** The currently selected target language ID. */
  /** Signal for selected language ID. */
  selectedLanguageId = this.store.selectSignal(Selectors.selectSelectedLanguageId);
  /** The target code generation format. */
  /** Signal for target output type. */
  target = this.store.selectSignal(Selectors.selectTarget);
  /** Options specific to the selected language. */
  /** Signal for current language options. */
  languageOptions = this.store.selectSignal(Selectors.selectCurrentLanguageOptions);

  /** The OpenAPI spec content. */
  /** Signal for OpenAPI spec content. */
  specContent = this.store.selectSignal(Selectors.selectOpenApiSpecContent);
  /** The currently selected input format (OpenAPI, Swagger, etc). */
  /** Signal for OpenAPI input format. */
  inputFormat = this.store.selectSignal(Selectors.selectOpenApiInputFormat);
  /** The list of generated files returned by the code generator. */
  /** Signal for generated files array. */
  generatedFiles = this.store.selectSignal(Selectors.selectGeneratedFiles);
  /** The currently active file path in the code viewer. */
  /** Signal for active file path. */
  activeFilePath = this.store.selectSignal(Selectors.selectActiveFilePath);
  /** The content of the currently active file. */
  /** Signal for active file content. */
  activeFileContent = this.store.selectSignal(Selectors.selectActiveFileContent);

  /** Computed selected example based on spec content. */
  /** Computed signal for selected example matching spec content. */
  selectedExample = computed<'petstore' | 'hello' | 'custom'>(() => {
    const content = this.specContent();
    if (content === PETSTORE_SPEC) return 'petstore';
    if (content === HELLO_WORLD_SPEC) return 'hello';
    return 'custom';
  });

  /**
   * Initializes the workspace and triggers an initial code generation run.
   */

  /** ngOnInit */
  ngOnInit(): void {
    this.store.dispatch(Actions.executeRun());
  }

  /**
   * Toggles the orientation of the split pane.
   */
  onSwap(): void {
    this.store.dispatch(Actions.toggleOrientation());
  }

  /**
   * Triggers a new code generation run.
   */
  onRun(): void {
    this.store.dispatch(Actions.executeRun());
  }

  /**
   * Handles language selection changes.
   * @param languageId The ID of the newly selected language.
   */
  onLanguageChanged(languageId: string): void {
    this.store.dispatch(Actions.setSelectedLanguage({ languageId }));
  }

  /**
   * Handles target format changes.
   * @param target The newly selected target format.
   */
  onTargetChanged(target: Target): void {
    this.store.dispatch(Actions.setTarget({ target }));
  }

  /**
   * Handles changes to language-specific options.
   * @param event The object containing the language ID and updated options.
   */
  onOptionsChanged(event: { languageId: string; options: LanguageOptions }): void {
    this.store.dispatch(Actions.setLanguageOptions(event));
  }

  /**
   * Updates the OpenAPI spec content in the store.
   * @param content The new spec content.
   */
  onSpecContentChange(content: string): void {
    this.store.dispatch(Actions.updateOpenApiSpec({ content }));
  }

  /**
   * Updates the input format in the store.
   * @param format The new input format.
   */
  onInputFormatChange(format: InputFormat): void {
    this.store.dispatch(Actions.setInputFormat({ format }));
  }

  /**
   * Handles example dropdown changes.
   * @param example The selected example ID.
   */
  onExampleChange(example: 'petstore' | 'hello' | 'custom'): void {
    if (example === 'petstore') {
      this.store.dispatch(Actions.updateOpenApiSpec({ content: PETSTORE_SPEC }));
    } else if (example === 'hello') {
      this.store.dispatch(Actions.updateOpenApiSpec({ content: HELLO_WORLD_SPEC }));
    }
  }

  /**
   * Updates the validation errors in the store.
   * @param errors The list of validation errors.
   */
  onValidationErrorsChange(errors: string[]): void {
    this.store.dispatch(Actions.setOpenApiValidationErrors({ errors }));
  }

  /**
   * Selects a file to display in the code viewer.
   * @param filePath The path of the file to select.
   */

  /** onFileSelected */
  onFileSelected(filePath: string): void {
    this.store.dispatch(Actions.selectFile({ filePath }));
  }

  /** Handles the mouse down event on the Bottom Pane resizer bar. */
  onResizerMouseDown(event: MouseEvent): void {
    event.preventDefault(); // Prevent text selection

    const startY = event.clientY;
    const startHeight = this.apiDocsPaneHeight();

    const mouseMove$ = fromEvent<MouseEvent>(this.document, 'mousemove').pipe(
      tap((e: MouseEvent) => {
        const delta = startY - e.clientY;
        let newHeight = startHeight + delta;
        // Enforce min/max constraints
        const minHeight = 150;
        const maxHeight = window.innerHeight * 0.8;
        newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

        this.store.dispatch(Actions.resizeApiDocsPane({ height: newHeight }));
      }),
    );

    const mouseUp$ = fromEvent<MouseEvent>(this.document, 'mouseup');

    mouseMove$.pipe(takeUntil(mouseUp$), takeUntil(this.destroy$)).subscribe();
  }

  /** Resets the Bottom pane height to the default on double click. */
  onResizerDoubleClick(): void {
    this.store.dispatch(Actions.resizeApiDocsPane({ height: 300 }));
  }

  /** Handles keyboard events on the Bottom Pane resizer bar for accessibility. */
  onResizerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.store.dispatch(Actions.resizeApiDocsPane({ height: this.apiDocsPaneHeight() + 20 }));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const newHeight = Math.max(150, this.apiDocsPaneHeight() - 20);
      this.store.dispatch(Actions.resizeApiDocsPane({ height: newHeight }));
    }
  }

  /** Toggles the API Docs pane visibility */
  toggleApiDocs(): void {
    this.store.dispatch(Actions.toggleApiDocsPane());
  }

  /** Handles global keyboard shortcuts */
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'd' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      event.preventDefault();
      this.toggleApiDocs();
    }
  }

  /** cleanup */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
