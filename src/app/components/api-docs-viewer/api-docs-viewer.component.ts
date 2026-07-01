import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  OnDestroy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/state';
import {
  selectOpenApiSpecContent,
  selectGeneratedFiles,
  selectSelectedLanguageId,
} from '../../store/selectors';
import * as WorkspaceActions from '../../store/actions';
import { ThemeService } from '../../services/theme.service';
import 'cdd-docs-ui';

/** Component for viewing API documentation dynamically via Web Component. */
@Component({
  selector: 'app-api-docs-viewer',
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="api-docs-content">
      <cdd-api-docs
        [attr.spec-content]="specContent()"
        [attr.theme]="theme()"
        [sdkExamples]="mappedSdkExamples()"
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

  /** OpenAPI spec content */
  specContent = this.store.selectSignal(selectOpenApiSpecContent);
  /** Generated files */
  generatedFiles = this.store.selectSignal(selectGeneratedFiles);
  /** Selected language ID */
  selectedLanguageId = this.store.selectSignal(selectSelectedLanguageId);

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

  /** Mapped SDK examples for the Lit component */
  mappedSdkExamples = computed(() => {
    const decoder = new TextDecoder('utf-8');
    const lang = this.normalizeLanguage(this.selectedLanguageId());
    return this.generatedFiles().map((file) => ({
      language: lang,
      filepath: file.path,
      content: decoder.decode(file.content),
    }));
  });

  /** Active theme signal derived from ThemeService */
  theme = computed(() => (this.themeService.isDarkTheme() ? 'dark' : 'light'));

  /** Init lifecycle */
  ngOnInit() {
    this.store.dispatch(WorkspaceActions.apiDocsIframeLoaded());
  }

  /** Destroy lifecycle */
  ngOnDestroy() {}

  /** Retries loading the docs */
  retryLoad() {
    this.store.dispatch(WorkspaceActions.setApiDocsVisibility({ visible: true }));
  }
}
