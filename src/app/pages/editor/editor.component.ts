import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  effect,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { WasmGeneratorService } from '../../services/wasm-generator.service';
import { ThemeService } from '../../services/theme.service';
import { LanguageService } from '../../services/language.service';
import { PETSTORE_SPEC, HELLO_WORLD_SPEC } from '../../models/examples';
import { NgOptimizedImage } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

/**
 * Editor component for interacting with OpenAPI specs and generated SDKs.
 */
@Component({
  selector: 'app-editor',
  imports: [
    MonacoEditorModule,
    FormsModule,
    RouterLink,
    NgOptimizedImage,
    MatButtonModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    MatRadioModule,
    MatTooltipModule,
  ],
  template: `
    <div class="editor-container">
      <header class="editor-header">
        <div class="breadcrumb">
          @if (repository()) {
            <a
              mat-button
              [routerLink]="['/organization', repository()?.organizationId]"
              i18n="@@backToRepositoryList"
              aria-label="Go back to repository list"
              >← Back to Repository List</a
            >
            <span class="divider">/</span> <strong>{{ repository()?.name }}</strong>
          } @else {
            <span class="sandbox-badge" i18n="@@sandboxMode">Sandbox Mode</span>
            <span class="sandbox-desc" i18n="@@sandboxDesc">Login/Dashboard to save your work</span>
          }
        </div>

        <div class="toolbar">
          <mat-form-field appearance="outline" class="example-select">
            <mat-label i18n="@@loadExample">Load Example</mat-label>
            <mat-select
              (selectionChange)="loadExample($event.value)"
              aria-label="Select an example specification"
            >
              <mat-option value="petstore" i18n="@@examplePetstore">Petstore</mat-option>
              <mat-option value="helloworld" i18n="@@exampleHelloWorld">Hello World</mat-option>
              <mat-option value="empty" i18n="@@exampleEmpty">Empty</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="icon-group" role="group" aria-label="Language selector">
            @for (lang of languages(); track lang.id) {
              <button
                type="button"
                [class]="
                  'icon-btn ' +
                  (!lang.availableInWasm ? 'disabled' : '') +
                  (selectedLanguages().has(lang.id) ? ' selected' : '')
                "
                (click)="toggleLanguage(lang.id)"
                [disabled]="!lang.availableInWasm"
                [matTooltip]="lang.name + (!lang.availableInWasm ? ' (Not available in WASM)' : '')"
                [attr.aria-label]="'Toggle ' + lang.name + ' language generation'"
                [attr.aria-pressed]="selectedLanguages().has(lang.id)"
              >
                <img
                  [ngSrc]="lang.iconUrl"
                  width="24"
                  height="24"
                  [attr.alt]="lang.name + ' logo'"
                  class="lang-icon"
                />
              </button>
            }
          </div>
          <button
            mat-flat-button
            color="primary"
            class="run-btn"
            (click)="onRun()"
            i18n="@@runGeneration"
            aria-label="Run Code Generation"
          >
            Run
          </button>
          <button
            mat-stroked-button
            class="swap-btn"
            (click)="toggleSwap()"
            matTooltip="Swap panes"
            i18n-matTooltip="@@swapPanes"
            aria-label="Swap Editor Panes"
          >
            ⇄
          </button>
        </div>
      </header>

      <div class="spec-source-toggle" role="group" aria-label="Specification Source">
        <mat-radio-group
          [ngModel]="specSourceType()"
          (ngModelChange)="specSourceType.set($event)"
          aria-label="Select an option"
        >
          <mat-radio-button value="inline" i18n="@@inlineSpec">Inline Spec</mat-radio-button>
          <mat-radio-button value="url" i18n="@@remoteUrl">Remote URL</mat-radio-button>
        </mat-radio-group>

        @if (specSourceType() === 'url') {
          <mat-form-field appearance="outline" class="url-input" subscriptSizing="dynamic">
            <mat-label i18n="@@remoteUrlLabel">Remote OpenAPI URL</mat-label>
            <input
              matInput
              type="url"
              placeholder="https://..."
              [ngModel]="specUrl()"
              (ngModelChange)="specUrl.set($event)"
              aria-label="Remote OpenAPI URL input"
            />
          </mat-form-field>
          <button
            mat-stroked-button
            color="primary"
            (click)="fetchRemoteSpec()"
            i18n="@@fetchUrl"
            aria-label="Fetch spec from remote URL"
          >
            Fetch
          </button>
        }
      </div>

      <main class="split-view" [class.swapped]="!openapiLeft()">
        <section class="pane openapi-pane" aria-labelledby="openapi-heading">
          <div class="pane-header">
            <h3 id="openapi-heading" i18n="@@openapiSpecHeading">OpenAPI Spec</h3>
          </div>
          <ngx-monaco-editor
            class="code-editor monaco-container"
            [ngModel]="openapiSpec()"
            (ngModelChange)="onOpenApiChange($event)"
            [options]="editorOptionsOpenApi()"
            aria-label="OpenAPI Specification Editor"
          ></ngx-monaco-editor>
        </section>

        <section class="pane sdk-pane" aria-labelledby="sdk-heading">
          <div class="pane-header">
            <div class="sdk-header-left">
              <h3 id="sdk-heading" i18n="@@generatedSdkHeading">Generated Source</h3>
              @if (activeLanguages().length > 0) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="sdk-select">
                  <mat-select
                    [ngModel]="activeSdkTab()"
                    (ngModelChange)="activeSdkTab.set($event)"
                    aria-label="Select SDK Language"
                  >
                    @for (lang of activeLanguages(); track lang.id) {
                      <mat-option [value]="lang.id">{{ lang.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              } @else {
                <span class="no-lang" i18n="@@noLanguageSelected">No language selected</span>
              }
            </div>
            @if (activeLanguages().length > 0) {
              <div class="output-type-toggle">
                <mat-radio-group
                  [ngModel]="activeOutputType()"
                  (ngModelChange)="activeOutputType.set($event)"
                  aria-label="Select output type"
                >
                  <mat-radio-button value="sdk" i18n="@@sdkOutput">SDK Code</mat-radio-button>
                  <mat-radio-button value="ci" i18n="@@ciOutput">CI/CD Config</mat-radio-button>
                </mat-radio-group>
              </div>
            }
          </div>
          <ngx-monaco-editor
            class="code-editor monaco-container"
            [ngModel]="getCurrentOutputCode()"
            (ngModelChange)="onSdkChange($event)"
            [options]="editorOptionsSdk()"
            aria-label="Generated Code Editor"
          ></ngx-monaco-editor>
        </section>
      </main>
    </div>
  `,
  styleUrl: './editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent implements OnInit {
  /** The current activated route. */
  private readonly route = inject(ActivatedRoute);
  /** The storage service instance. */
  private readonly storage = inject(StorageService);
  /** The language service instance. */
  private readonly langService = inject(LanguageService);
  /** The WASM generator service instance. */
  private readonly wasm = inject(WasmGeneratorService);
  private readonly theme = inject(ThemeService);

  /** The ID of the currently loaded repository. */
  readonly repositoryId = signal<string | null>(null);

  /** Computed signal for the current repository object. */
  readonly repository = computed(() => {
    const id = this.repositoryId();
    if (!id) return null;
    return this.storage.repositories().find((r) => r.id === id) || null;
  });

  /** List of all supported languages. */
  readonly languages = this.langService.languages;

  /** The set of languages currently selected by the user. */
  selectedLanguages = signal<Set<string | number>>(
    new Set(
      this.langService
        .languages()
        .filter((l) => l.selectedByDefault && l.availableInWasm)
        .map((l) => l.id),
    ),
  );

  /** True if OpenAPI is on the left, false if swapped. */
  openapiLeft = signal(true);

  /** The source type for the OpenAPI spec. */
  specSourceType = signal<'inline' | 'url'>('inline');

  /** The URL of the remote OpenAPI spec, if applicable. */
  specUrl = signal('');

  /** The content of the OpenAPI specification. */
  openapiSpec = signal(PETSTORE_SPEC);

  /** The generated SDK codes, keyed by language ID. */
  sdkCodes = signal<Record<string | number, string>>({});

  /** The generated CI/CD codes, keyed by language ID. */
  ciCodes = signal<Record<string | number, string>>({});

  /** The ID of the language currently active in the SDK pane. */
  activeSdkTab = signal<string | number | null>(null);

  /** The type of output currently active in the right pane. */
  activeOutputType = signal<'sdk' | 'ci'>('sdk');

  /** Computed list of actively selected languages. */
  activeLanguages = computed(() => {
    return this.languages().filter((l) => this.selectedLanguages().has(l.id));
  });

  /** Subject for handling OpenAPI spec changes with debounce. */
  private openApiChangeSubject = new Subject<string>();
  /** Subject for handling SDK code changes with debounce. */
  private sdkChangeSubject = new Subject<string>();

  /** Computed editor options for the OpenAPI pane. */
  editorOptionsOpenApi = computed(() => ({
    theme: this.theme.isDarkTheme() ? 'vs-dark' : 'vs-light',
    language: 'yaml',
  }));

  /** Computed editor options for the SDK pane based on the active state. */
  editorOptionsSdk = computed(() => {
    const isReadOnly = this.openapiLeft() || this.activeOutputType() === 'ci';
    const language =
      this.activeOutputType() === 'ci' ? 'yaml' : this.getMonacoLanguageId(this.activeSdkTab());

    return {
      theme: this.theme.isDarkTheme() ? 'vs-dark' : 'vs-light',
      language: language,
      readOnly: isReadOnly,
    };
  });

  /**
   * Initializes the editor component, setting up reactive effects for state synchronization.
   */
  constructor() {
    effect(() => {
      const active = this.activeLanguages();
      if (active.length > 0) {
        const currentTab = this.activeSdkTab();
        if (!currentTab || !active.find((l) => l.id === currentTab)) {
          this.activeSdkTab.set(active[0].id);
        }
      } else {
        this.activeSdkTab.set(null);
      }
    });

    // Real-time Live Preview: OpenAPI -> SDK
    this.openApiChangeSubject.pipe(debounceTime(500), distinctUntilChanged()).subscribe(() => {
      if (this.openapiLeft()) {
        this.onRun();
      }
    });

    // Real-time Live Preview: SDK -> OpenAPI
    this.sdkChangeSubject.pipe(debounceTime(500), distinctUntilChanged()).subscribe(() => {
      if (!this.openapiLeft() && this.activeOutputType() === 'sdk') {
        this.onRun();
      }
    });
  }

  /**
   * Initializes the component and loads the repository if present.
   */
  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.repositoryId.set(id);
        const repo = this.storage.repositories().find((r) => r.id === id);
        if (repo) {
          this.openapiSpec.set(repo.openApiSpec || '');
          this.specUrl.set(repo.specUrl || '');
          if (repo.specUrl) {
            this.specSourceType.set('url');
          }
        }
      }
    });
  }

  /**
   * Handles changes to the OpenAPI specification content.
   * @param value The updated OpenAPI spec content.
   */
  onOpenApiChange(value: string): void {
    this.openapiSpec.set(value);
    this.openApiChangeSubject.next(value);
  }

  /**
   * Handles changes to the SDK code content.
   * @param value The updated SDK code content.
   */
  onSdkChange(value: string): void {
    this.setCurrentOutputCode(value);
    this.sdkChangeSubject.next(value);
  }

  /**
   * Retrieves the generated code for the currently active SDK tab and output type.
   * @returns The generated code string.
   */
  getCurrentOutputCode(): string {
    const tab = this.activeSdkTab();
    if (!tab) return '';
    if (this.activeOutputType() === 'sdk') {
      return this.sdkCodes()[tab] || '';
    } else {
      return this.ciCodes()[tab] || '';
    }
  }

  /**
   * Updates the generated code for the currently active SDK tab (SDK only).
   * @param value The new code string.
   */
  setCurrentOutputCode(value: string): void {
    const tab = this.activeSdkTab();
    if (tab && this.activeOutputType() === 'sdk') {
      this.sdkCodes.update((codes) => ({ ...codes, [tab]: value }));
    }
  }

  /**
   * Loads a predefined example specification.
   * @param exampleType The type of example to load ('petstore', 'helloworld', or 'empty').
   */
  loadExample(exampleType: string): void {
    let specValue = '';
    if (exampleType === 'petstore') {
      specValue = PETSTORE_SPEC;
    } else if (exampleType === 'helloworld') {
      specValue = HELLO_WORLD_SPEC;
    }
    this.openapiSpec.set(specValue);

    // Trigger live preview update
    this.openApiChangeSubject.next(specValue);
  }

  /**
   * Toggles a language in the selected languages set.
   * @param id The ID of the language to toggle.
   */
  toggleLanguage(id: string | number): void {
    const lang = this.languages().find((l) => l.id === id);
    if (!lang || !lang.availableInWasm) return;

    this.selectedLanguages.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  /**
   * Swaps the left and right panes.
   */
  toggleSwap(): void {
    this.openapiLeft.update((v) => !v);
  }

  /**
   * Translates internal language IDs to Monaco editor language identifiers.
   */
  private getMonacoLanguageId(langId: string | number | null): string {
    if (!langId) return 'plaintext';
    switch (langId) {
      case 'python':
        return 'python';
      case 'rust':
        return 'rust';
      case 'typescript':
        return 'typescript';
      case 'go':
        return 'go';
      case 'java':
        return 'java';
      default:
        return 'plaintext';
    }
  }

  /**
   * Simulates fetching an OpenAPI specification from a remote URL.
   */
  async fetchRemoteSpec(): Promise<void> {
    const url = this.specUrl();
    if (!url) return;

    try {
      // Use fetch to allow mocking errors in tests
      const response = await fetch(url);
      if (!response.ok) throw new Error('Fetch failed');
      const text = await response.text();
      this.openapiSpec.set(text);

      // Trigger live preview update
      this.openApiChangeSubject.next(text);
    } catch (err) {
      console.error('Failed to fetch spec', err);
    }
  }

  /**
   * Runs the code generation process (OpenAPI -> SDK or SDK -> OpenAPI).
   */
  async onRun(): Promise<void> {
    const spec = this.openapiSpec();
    const updatedSdkCodes: Record<string, string> = { ...this.sdkCodes() };
    const updatedCiCodes: Record<string, string> = { ...this.ciCodes() };
    const langsToGen = Array.from(this.selectedLanguages());

    // Using a mock repository for generation params if none loaded
    const r = this.repository() || {
      id: 'sandbox',
      name: 'Sandbox',
      organizationId: '',
      userId: '',
    };

    if (this.openapiLeft()) {
      // OpenAPI -> SDK & CI/CD
      for (const langId of langsToGen) {
        const sdkCode = await this.wasm.generateSdk(r, langId, spec);
        updatedSdkCodes[langId] = sdkCode;

        const ciCode = await this.wasm.generateCiCd(r, langId);
        updatedCiCodes[langId] = ciCode;
      }
      this.sdkCodes.set(updatedSdkCodes);
      this.ciCodes.set(updatedCiCodes);

      // Save spec to repository if working in repository
      if (this.repository()) {
        this.storage.updateRepository({ ...r, openApiSpec: spec, specUrl: this.specUrl() });
      }
    } else {
      // SDK -> OpenAPI
      const currentSdkTab = this.activeSdkTab();
      if (!currentSdkTab) return;

      if (this.activeOutputType() === 'sdk') {
        const code = this.getCurrentOutputCode();
        const newSpec = await this.wasm.generateOpenApi(r, currentSdkTab, code);
        this.openapiSpec.set(newSpec);

        // Save spec to repository if working in repository
        if (this.repository()) {
          this.storage.updateRepository({ ...r, openApiSpec: newSpec, specUrl: this.specUrl() });
        }
      }
    }
  }
}
