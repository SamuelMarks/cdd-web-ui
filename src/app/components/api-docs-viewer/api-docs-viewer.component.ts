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
  selectDocsJsonExamples,
  selectDocsJsonLanguageId,
  selectSelectedLanguageId,
  selectCurrentLanguageOptions,
} from '../../store/selectors';
import * as WorkspaceActions from '../../store/actions';
import { ThemeService } from '../../services/theme.service';
import { WasmWorkerService, GeneratedFile } from '../../services/wasm-worker.service';
import { LanguageService } from '../../services/language.service';
import 'cdd-docs-ui';

/**
 * Checks whether a generated file path is a build manifest, configuration file, documentation file,
 * CI workflow, or test file that should be excluded when forwarding `to_sdk` files as SDK examples.
 * @param filepath The relative file path to inspect.
 * @returns True if the file should be excluded from SDK code examples.
 */
export function isExcludedSdkProjectFile(filepath: string): boolean {
  const normalized = filepath.replace(/\\/g, '/').replace(/^\/+/, '');
  const basename = normalized.split('/').pop() || normalized;
  const excludedNames = new Set([
    'Cargo.toml',
    'Cargo.lock',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'CMakeLists.txt',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'settings.gradle',
    'settings.gradle.kts',
    'README.md',
    'LICENSE',
    'Makefile',
    'Dockerfile',
    'pyproject.toml',
    'setup.py',
    'Gemfile',
    'composer.json',
    'go.mod',
    'go.sum',
    'Package.swift',
    '.gitignore',
  ]);
  if (excludedNames.has(basename)) {
    return true;
  }
  if (normalized.startsWith('.github/')) {
    return true;
  }
  if (/test/i.test(normalized)) {
    return true;
  }
  return false;
}

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
        [attr.active-language]="activeUiLanguage()"
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
  /** Dedicated or extracted docs.json files from store */
  docsJsonExamples = this.store.selectSignal(selectDocsJsonExamples);
  /** Language ID associated with dedicated docs.json files in store */
  docsJsonLanguageId = this.store.selectSignal(selectDocsJsonLanguageId);
  /** Selected language ID */
  selectedLanguageId = this.store.selectSignal(selectSelectedLanguageId);
  /** Current language options */
  languageOptions = this.store.selectSignal(selectCurrentLanguageOptions);

  /** Active normalized UI language name for `<cdd-api-docs>` */
  activeUiLanguage = computed(() => this.normalizeLanguage(this.selectedLanguageId()));

  /** Cached `docs.json` content keyed by normalized UI language */
  docsJsonCache = signal<Record<string, string>>({});

  /**
   * Initializes reactive effects to fetch `to_docs_json` when spec or language changes
   * and sync store `docs.json` files into the local language cache.
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

    effect(() => {
      const activeDocsFiles = this.getActiveStoreDocsFiles();
      const lang = this.activeUiLanguage();
      if (activeDocsFiles.length > 0) {
        const decoder = new TextDecoder('utf-8');
        const content = this.unwrapDocsJsonContent(decoder.decode(activeDocsFiles[0].content));
        this.docsJsonCache.update((prev) => ({ ...prev, [lang]: content }));
      }
    });
  }

  /**
   * Maps any of the 13 language or ecosystem identifiers to a consistent `cdd-docs-ui` language name.
   * @param langId The raw language ID or ecosystem repo from the store.
   * @returns The normalized language name expected by `cdd-docs-ui`.
   */
  private normalizeLanguage(langId: string): string {
    if (!langId) return 'typescript';
    const clean = langId.replace(/^cdd-/, '');
    const langMap: Record<string, string> = {
      c: 'c',
      cpp: 'cpp',
      csharp: 'csharp',
      go: 'go',
      java: 'java',
      kotlin: 'kotlin',
      php: 'php',
      python: 'python',
      'python-all': 'python',
      ruby: 'ruby',
      rust: 'rust',
      sh: 'bash',
      bash: 'bash',
      swift: 'swift',
      ts: 'typescript',
      typescript: 'typescript',
    };
    return langMap[clean] || clean;
  }

  /**
   * Unwraps a single-element JSON array wrapping an `endpoints`, `workflows`, or `webhooks` object.
   * @param raw Raw UTF-8 `docs.json` content string.
   * @returns Normalized JSON string.
   */
  private unwrapDocsJsonContent(raw: string): string {
    let content = raw;
    if (content.trim().startsWith('[')) {
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
    return content;
  }

  /**
   * Returns `docs.json` files from the store only when they belong to the currently selected language.
   * @returns Array of matching `docs.json` files from store state.
   */
  private getActiveStoreDocsFiles(): GeneratedFile[] {
    const lang = this.activeUiLanguage();
    const storeDocsLangId = this.docsJsonLanguageId();
    if (storeDocsLangId && this.normalizeLanguage(storeDocsLangId) !== lang) {
      return [];
    }
    const dedicatedDocsFiles = this.docsJsonExamples();
    const rawFiles = this.generatedFiles();
    const docsFilesInRaw = rawFiles.filter(
      (f) => f.path === 'docs.json' || f.path.endsWith('/docs.json'),
    );
    const candidateFiles = dedicatedDocsFiles.length > 0 ? dedicatedDocsFiles : docsFilesInRaw;
    const decoder = new TextDecoder('utf-8');
    return candidateFiles.filter((file) => {
      const text = decoder.decode(file.content).trim();
      try {
        const parsed: unknown = JSON.parse(text);
        const item: unknown = Array.isArray(parsed) ? parsed[0] : parsed;
        if (
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>)['language'] === 'string'
        ) {
          return (
            this.normalizeLanguage((item as Record<string, unknown>)['language'] as string) === lang
          );
        }
      } catch {
        // Keep file when JSON is not parseable
      }
      return true;
    });
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
      const docsFile = files.find(
        (f) => f.path === 'docs.json' || f.path.endsWith('/docs.json') || f.path.endsWith('.json'),
      );
      if (docsFile) {
        const decoder = new TextDecoder('utf-8');
        const content = this.unwrapDocsJsonContent(decoder.decode(docsFile.content));
        const uiLang = this.normalizeLanguage(langConfig.repo);
        this.docsJsonCache.update((prev) => ({ ...prev, [uiLang]: content }));
      }
    } catch (err: unknown) {
      console.warn(`[ApiDocsViewer] Failed to generate docs.json for ${langConfig.repo}:`, err);
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
    const lang = this.activeUiLanguage();
    const activeDocsFiles = this.getActiveStoreDocsFiles();

    const fromStore = activeDocsFiles.map((file) => {
      const content = this.unwrapDocsJsonContent(decoder.decode(file.content));
      return {
        language: lang,
        filepath: 'docs.json',
        content,
      };
    });

    const cached = this.docsJsonCache();
    const activeCachedEntries: MappedSdkExample[] = [];
    const otherCachedEntries: MappedSdkExample[] = [];
    for (const [cachedLang, content] of Object.entries(cached)) {
      if (!fromStore.some((f) => f.language === cachedLang && f.filepath === 'docs.json')) {
        const entry: MappedSdkExample = {
          language: cachedLang,
          filepath: 'docs.json',
          content,
        };
        if (cachedLang === lang) {
          activeCachedEntries.push(entry);
        } else {
          otherCachedEntries.push(entry);
        }
      }
    }

    return [...fromStore, ...activeCachedEntries, ...otherCachedEntries];
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
