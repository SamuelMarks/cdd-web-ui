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
import { LANGUAGES } from '../../models/constants';
import { PETSTORE_SPEC, HELLO_WORLD_SPEC } from '../../models/examples';
import { NgOptimizedImage } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Editor component for interacting with OpenAPI specs and generated SDKs.
 */
@Component({
  selector: 'app-editor',
  imports: [
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
            @for (lang of languages; track lang.id) {
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
          <textarea
            class="code-editor"
            [ngModel]="openapiSpec()"
            (ngModelChange)="openapiSpec.set($event)"
            placeholder="Enter OpenAPI spec here..."
            i18n-placeholder="@@openapiSpecPlaceholder"
            aria-label="OpenAPI Specification Editor"
          ></textarea>
        </section>

        <section class="pane sdk-pane" aria-labelledby="sdk-heading">
          <div class="pane-header">
            <h3 id="sdk-heading" i18n="@@generatedSdkHeading">Generated SDK</h3>
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
          <textarea
            class="code-editor"
            [ngModel]="getCurrentSdkCode()"
            (ngModelChange)="setCurrentSdkCode($event)"
            placeholder="Generated SDK code will appear here..."
            i18n-placeholder="@@generatedSdkPlaceholder"
            [readonly]="openapiLeft()"
            aria-label="Generated SDK Editor"
          ></textarea>
        </section>
      </main>
    </div>
  `,
  styleUrl: './editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly storage = inject(StorageService);
  private readonly wasm = inject(WasmGeneratorService);

  /** The ID of the currently loaded repository. */
  readonly repositoryId = signal<string | null>(null);

  /** Computed signal for the current repository object. */
  readonly repository = computed(() => {
    const id = this.repositoryId();
    if (!id) return null;
    return this.storage.repositories().find((r) => r.id === id) || null;
  });

  /** List of all supported languages. */
  languages = LANGUAGES;

  /** The set of languages currently selected by the user. */
  selectedLanguages = signal<Set<string>>(
    new Set(LANGUAGES.filter((l) => l.selectedByDefault && l.availableInWasm).map((l) => l.id)),
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
  sdkCodes = signal<Record<string, string>>({});

  /** The ID of the language currently active in the SDK pane. */
  activeSdkTab = signal<string | null>(null);

  /** Computed list of actively selected languages. */
  activeLanguages = computed(() => {
    return this.languages.filter((l) => this.selectedLanguages().has(l.id));
  });

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
   * Retrieves the generated code for the currently active SDK tab.
   * @returns The generated code string.
   */
  getCurrentSdkCode(): string {
    const tab = this.activeSdkTab();
    if (!tab) return '';
    return this.sdkCodes()[tab] || '';
  }

  /**
   * Updates the generated code for the currently active SDK tab.
   * @param value The new code string.
   */
  setCurrentSdkCode(value: string): void {
    const tab = this.activeSdkTab();
    if (tab) {
      this.sdkCodes.update((codes) => ({ ...codes, [tab]: value }));
    }
  }

  /**
   * Loads a predefined example specification.
   * @param exampleType The type of example to load ('petstore', 'helloworld', or 'empty').
   */
  loadExample(exampleType: string): void {
    if (exampleType === 'petstore') {
      this.openapiSpec.set(PETSTORE_SPEC);
    } else if (exampleType === 'helloworld') {
      this.openapiSpec.set(HELLO_WORLD_SPEC);
    } else {
      this.openapiSpec.set('');
    }
  }

  /**
   * Toggles a language in the selected languages set.
   * @param id The ID of the language to toggle.
   */
  toggleLanguage(id: string): void {
    const lang = this.languages.find((l) => l.id === id);
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
   * Simulates fetching an OpenAPI specification from a remote URL.
   */
  async fetchRemoteSpec(): Promise<void> {
    const url = this.specUrl();
    if (!url) return;
    try {
      // In a real app we'd fetch this. We'll simulate it for offline demo.
      const fakeSpec = `openapi: 3.1.0\ninfo:\n  title: Remote API\n  version: 1.0.0\npaths: {}`;
      this.openapiSpec.set(fakeSpec);
    } catch (err) {
      console.error('Failed to fetch spec', err);
    }
  }

  /**
   * Runs the code generation process (OpenAPI -> SDK or SDK -> OpenAPI).
   */
  async onRun(): Promise<void> {
    const spec = this.openapiSpec();
    const updatedCodes: Record<string, string> = { ...this.sdkCodes() };
    const langsToGen = Array.from(this.selectedLanguages());

    // Using a mock repository for generation params if none loaded
    const r = this.repository() || {
      id: 'sandbox',
      name: 'Sandbox',
      organizationId: '',
      userId: '',
    };

    if (this.openapiLeft()) {
      // OpenAPI -> SDK
      for (const langId of langsToGen) {
        const code = await this.wasm.generateSdk(r, langId, spec);
        updatedCodes[langId] = code;
      }
      this.sdkCodes.set(updatedCodes);

      // Save spec to repository if working in repository
      if (this.repository()) {
        this.storage.updateRepository({ ...r, openApiSpec: spec, specUrl: this.specUrl() });
      }
    } else {
      // SDK -> OpenAPI
      const currentSdkTab = this.activeSdkTab();
      if (!currentSdkTab) return;

      const code = this.getCurrentSdkCode();
      const newSpec = await this.wasm.generateOpenApi(r, currentSdkTab, code);
      this.openapiSpec.set(newSpec);

      // Save spec to repository if working in repository
      if (this.repository()) {
        this.storage.updateRepository({ ...r, openApiSpec: newSpec, specUrl: this.specUrl() });
      }
    }
  }
}
