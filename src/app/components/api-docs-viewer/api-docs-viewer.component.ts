
import {
  Component,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  OnDestroy,
  effect
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Store } from "@ngrx/store";
import { AppState } from "../../store/state";
import { selectOpenApiSpecContent, selectGeneratedFiles } from "../../store/selectors";
import * as WorkspaceActions from "../../store/actions";
import { ThemeService } from "../../services/theme.service";
import "cdd-docs-ui";

/** Component for viewing API documentation dynamically via Web Component. */
@Component({
  selector: "app-api-docs-viewer",
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="api-docs-content">
      <cdd-api-docs
        [attr.spec-content]="specContent()"
        [attr.theme]="theme()"
        [sdkExamples]="generatedFiles()"
      ></cdd-api-docs>
    </div>
  `,
  styles: [`
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
  `]
})
export class ApiDocsViewerComponent implements OnInit, OnDestroy {
  private store = inject(Store<AppState>);
  private themeService = inject(ThemeService);

  specContent = this.store.selectSignal(selectOpenApiSpecContent);
  generatedFiles = this.store.selectSignal(selectGeneratedFiles);

  /** Active theme signal derived from ThemeService */
  theme = () => this.themeService.isDarkTheme() ? "dark" : "light";

  ngOnInit() {
    this.store.dispatch(WorkspaceActions.apiDocsIframeLoaded());
  }

  ngOnDestroy() {}

  retryLoad() {
    this.store.dispatch(WorkspaceActions.setApiDocsVisibility({ visible: true }));
  }
}
