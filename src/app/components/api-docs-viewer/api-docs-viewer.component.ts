/**
 * API documentation viewer component wrapping the cdd-api-docs Web Component.
 * @module app/components/api-docs-viewer/api-docs-viewer.component
 */
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  OnDestroy,
  computed,
  signal,
  effect,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/state';
import {
  selectOpenApiSpecContent,
  selectGeneratedFiles,
  selectSelectedLanguageId,
  selectCurrentLanguageOptions,
} from '../../store/selectors';
import * as WorkspaceActions from '../../store/actions';
import { ThemeService } from '../../services/theme.service';
import { WasmWorkerService } from '../../services/wasm-worker.service';
import { LanguageService } from '../../services/language.service';
import 'cdd-docs-ui';

/**
 * Single SDK code example item passed to `<cdd-api-docs>`.
 */
export interface MappedSdkExample {
  /** Normalized Prism/UI language name. */
  language: string;
  /** File path or synthetic `docs.json` identifier. */
  filepath: string;
  /** Raw UTF-8 file or JSON content. */
  content: string;
}

/** Component for viewing API documentation dynamically via Web Component. */
@Component({
  selector: 'app-api-docs-viewer',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="api-docs-content">
      <cdd-api-docs
        [attr.spec-content]="specContent()"
        [attr.theme]="theme()"
        [sdkExamples]="mappedSdkExamples()"
        (cdd-language-change)="onDocsLanguageChange($event)"
      ></cdd-api-docs>
    </div>
  `,
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
      .api-docs-content {
        flex: 1;
        height: 100%;
        width: 100%;
      }
      cdd-api-docs {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class ApiDocsViewerComponent implements OnInit, OnDestroy {
  /** Redux store */
  private store = inject(Store<AppState>);
  /** Theme service */
  private themeService = inject(ThemeService);
  /** Optional WASM worker service for generating `to_docs_json` snippets */
  private wasmWorkerService = inject(WasmWorkerService);
  /** Language configuration service */
  private languageService = inject(LanguageService);

  /** OpenAPI spec content */
  specContent = this.store.selectSignal(selectOpenApiSpecContent);
  /** Generated files */
  generatedFiles = this.store.selectSignal(selectGeneratedFiles);
  /** Selected language ID */
  selectedLanguageId = this.store.selectSignal(selectSelectedLanguageId);
  /** Current language options */
  languageOptions = this.store.selectSignal(selectCurrentLanguageOptions);

  /** Cached `docs.json` content keyed by normalized UI language */
  docsJsonCache = signal<Record<string, string>>({});

  /**
   * Initializes reactive effect to fetch `to_docs_json` when spec or language changes.
   */
  constructor() {
    effect(() => {
      const spec = this.specContent();
      const langId = this.selectedLanguageId();
      const opts = this.languageOptions();
      if (spec && langId) {
        void this.fetchDocsJsonForLanguage(langId, spec, opts);
      }
    });
  }

  /**
   * Maps the language ID to a Prism.js compatible syntax name
   * @param langId The raw language ID from the store
   * @returns The normalized language name
   */
  private normalizeLanguage(langId: string): string {
    if (!langId) return 'typescript';
    const clean = langId.replace('cdd-', '');
    if (clean === 'python-all') return 'python';
    if (clean === 'sh') return 'bash';
    return clean;
  }

  /**
   * Invokes the WASM worker with `to_docs_json` for the specified language and caches the result.
   * @param langId Language identifier (e.g., `ruby`, `csharp`, `typescript`).
   * @param spec OpenAPI specification string.
   * @param options Language generation options.
   */
  async fetchDocsJsonForLanguage(
    langId: string,
    spec: string,
    options?: Record<string, unknown>,
  ): Promise<void> {
    const langs = this.languageService.languages();
    const langConfig = langs.find((l) => l.id === langId || l.repo === langId);
    if (!langConfig || !langConfig.availableInWasm) return;

    try {
      const files = await this.wasmWorkerService.generateCode(
        langConfig.repo,
        spec,
        'to_docs_json',
        options || {},
      );
      const docsFile = files.find((f) => f.path === 'docs.json' || f.path.endsWith('.json'));
      if (docsFile) {
        const decoder = new TextDecoder('utf-8');
        const content = decoder.decode(docsFile.content);
        const uiLang = this.normalizeLanguage(langConfig.repo);
        this.docsJsonCache.update((prev) => ({ ...prev, [uiLang]: content }));
      }
    } catch {
      // Ignore background to_docs_json errors
    }
  }

  /**
   * Handles language selection changes emitted by `<cdd-api-docs>` and triggers `to_docs_json`.
   * @param event Custom event containing `detail.language`.
   */
  onDocsLanguageChange(event: Event): void {
    const customEv = event as CustomEvent<{
      /** Selected language identifier in cdd-docs-ui. */
      language?: string;
    }>;
    const rawLang = customEv.detail?.language;
    if (!rawLang) return;
    const langMap: Record<string, string> = {
      bash: 'sh',
      ts: 'typescript',
      'python-all': 'python',
    };
    const languageId = langMap[rawLang] || rawLang;
    if (this.specContent()) {
      void this.fetchDocsJsonForLanguage(
        languageId,
        this.specContent(),
        this.languageOptions() || {},
      );
    }
  }

  /** Mapped SDK examples for the Web Component */
  mappedSdkExamples = computed<MappedSdkExample[]>(() => {
    const decoder = new TextDecoder('utf-8');
    const lang = this.normalizeLanguage(this.selectedLanguageId());
    const fromStore = this.generatedFiles().map((file) => {
      let content = decoder.decode(file.content);
      if (file.path === 'docs.json' && content.trim().startsWith('[')) {
        try {
          const parsed: unknown = JSON.parse(content);
          if (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            typeof parsed[0] === 'object' &&
            parsed[0] !== null &&
            ('endpoints' in parsed[0] || 'workflows' in parsed[0] || 'webhooks' in parsed[0])
          ) {
            content = JSON.stringify(parsed[0]);
          }
        } catch {
          // Keep original content if JSON parsing fails
        }
      }
      return {
        language: lang,
        filepath: file.path,
        content,
      };
    });

    const cached = this.docsJsonCache();
    const cachedEntries: MappedSdkExample[] = [];
    for (const [cachedLang, content] of Object.entries(cached)) {
      if (!fromStore.some((f) => f.language === cachedLang && f.filepath === 'docs.json')) {
        cachedEntries.push({
          language: cachedLang,
          filepath: 'docs.json',
          content,
        });
      }
    }

    return [...cachedEntries, ...fromStore];
  });

  /** Active theme signal derived from ThemeService */
  theme = computed(() => (this.themeService.isDarkTheme() ? 'dark' : 'light'));

  /** Init lifecycle */
  ngOnInit(): void {
    this.store.dispatch(WorkspaceActions.apiDocsIframeLoaded());
  }

  /** Destroy lifecycle */
  ngOnDestroy(): void {}

  /** Retries loading the docs */
  retryLoad(): void {
    this.store.dispatch(WorkspaceActions.setApiDocsVisibility({ visible: true }));
  }
}
