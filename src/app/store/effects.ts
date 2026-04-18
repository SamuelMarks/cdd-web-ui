import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, switchMap, withLatestFrom, tap, of } from 'rxjs';
import * as WorkspaceActions from './actions';
import { AppState } from './state';
import {
  selectOrientation,
  selectSelectedLanguageId,
  selectOpenApiSpecContent,
  selectTarget,
  selectCurrentLanguageOptions,
  selectIsApiDocsVisible,
  selectApiDocsPaneHeight,
  selectOpenApiInputFormat,
  selectActiveFileContent,
} from './selectors';
import { WasmWorkerService } from '../services/wasm-worker.service';
import { LanguageService } from '../services/language.service';
import { NotificationService } from '../services/notification.service';

/**
 * NgRx Effects for handling side-effects of workspace actions, primarily WASM execution.
 */
@Injectable()
/** WorkspaceEffects */
export class WorkspaceEffects {
  /** Injected Actions stream */
  private actions$ = inject(Actions);
  /** Injected NgRx Store */
  private store = inject(Store<AppState>);
  /** Injected WasmWorkerService */
  private wasmWorkerService = inject(WasmWorkerService);
  /** Injected LanguageService */
  private languageService = inject(LanguageService);
  /** Injected NotificationService */
  private notificationService = inject(NotificationService);

  /**
   * Effect that listens for `executeRun` action.
   * Based on the current orientation (left vs right), it determines
   * whether to run `from_openapi` (generate code) or `to_openapi` (generate spec).
   */
  executeRun$ = createEffect(() =>
    this.actions$.pipe(
      ofType(WorkspaceActions.executeRun),
      withLatestFrom(
        this.store.select(selectOrientation),
        this.store.select(selectSelectedLanguageId),
        this.store.select(selectOpenApiSpecContent),
        this.store.select(selectTarget),
        this.store.select(selectCurrentLanguageOptions),
        this.store.select(selectOpenApiInputFormat),
        this.store.select(selectActiveFileContent),
      ),
      switchMap(
        ([
          _,
          orientation,
          languageId,
          specContent,
          target,
          languageOptions,
          inputFormat,
          activeFileContent,
        ]) => {
          // Dispatch start action immediately to show loading state
          this.store.dispatch(WorkspaceActions.executeRunStart());

          const lang = this.languageService.languages().find((l) => l.id === languageId);

          if (!lang) {
            return of(
              WorkspaceActions.executeRunFailure({
                error: `Selected language ID '${languageId}' not found.`,
              }),
            );
          }

          if (!lang.availableInWasm) {
            return of(
              WorkspaceActions.executeRunFailure({
                error: `Language '${lang.name}' does not support offline WASM generation.`,
              }),
            );
          }

          if (orientation === 'openapi-left') {
            // Direction: from_openapi -> Code Generation

            // Override target if language is openapi
            const actualTarget = languageId === 'openapi' ? 'to_openapi_3_2_0' : target;

            let upgradePromise = Promise.resolve(specContent);

            if (inputFormat !== 'openapi_3_2_0' && lang.repo !== 'cdd-cpp') {
              // Need to upgrade spec using cdd-cpp first
              upgradePromise = this.wasmWorkerService
                .generateCode('cdd-cpp', specContent, 'to_openapi_3_2_0', {
                  inputFormat,
                })
                .then((files) => {
                  const specFile = files.find(
                    (f) =>
                      f.path.endsWith('.yaml') ||
                      f.path.endsWith('.json') ||
                      f.path.includes('openapi'),
                  );
                  if (specFile) {
                    return new TextDecoder().decode(specFile.content);
                  }
                  return specContent; // fallback
                });
            }

            return upgradePromise
              .then((upgradedSpec) =>
                this.wasmWorkerService.generateCode(
                  lang.repo,
                  upgradedSpec,
                  actualTarget,
                  languageOptions,
                ),
              )
              .then(
                (files) => WorkspaceActions.executeRunSuccess({ result: files }),
                (error) =>
                  WorkspaceActions.executeRunFailure({
                    error: error instanceof Error ? error.message : String(error),
                  }),
              );
          } else {
            // Direction: to_openapi -> Spec Generation
            return this.wasmWorkerService
              .generateCode(lang.repo, activeFileContent || '', 'to_openapi', languageOptions)
              .then((files) => {
                const specFile = files.find(
                  (f) =>
                    f.path.endsWith('.yaml') ||
                    f.path.endsWith('.json') ||
                    f.path.includes('openapi'),
                );
                if (specFile) {
                  return WorkspaceActions.executeRunSuccess({
                    result: new TextDecoder().decode(specFile.content),
                  });
                }
                return WorkspaceActions.executeRunFailure({
                  error: 'No OpenAPI specification generated.',
                });
              })
              .catch((error) =>
                WorkspaceActions.executeRunFailure({
                  error: error instanceof Error ? error.message : String(error),
                }),
              );
          }
        },
      ),
    ),
  );

  /**
   * Effect that handles successful execution outcomes.
   * Updates appropriate state (Files or OpenAPI) depending on what was generated.
   */
  handleExecutionSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(WorkspaceActions.executeRunSuccess),
        tap(({ result }) => {
          if (Array.isArray(result)) {
            // It's a list of generated files (from_openapi)
            this.store.dispatch(WorkspaceActions.setGeneratedFiles({ files: result }));
            this.notificationService.success(`Successfully generated ${result.length} file(s).`);
          } else if (typeof result === 'string') {
            // It's an OpenAPI spec string (to_openapi)
            this.store.dispatch(WorkspaceActions.updateOpenApiSpec({ content: result }));
            this.notificationService.success('Successfully generated OpenAPI specification.');
          }
        }),
      ),
    { dispatch: false },
  );

  /**
   * Effect that handles execution failures by showing a toast notification.
   */
  handleExecutionFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(WorkspaceActions.executeRunFailure),
        tap(({ error }) => {
          this.notificationService.error(`Execution failed: ${error}`);
        }),
      ),
    { dispatch: false },
  );

  /**
   * Initialize API Docs state from localStorage.
   */
  initApiDocsState$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      map(() => {
        const storedVisible = localStorage.getItem('apiDocsVisible');
        const storedHeight = localStorage.getItem('apiDocsPaneHeight');

        if (storedVisible !== null) {
          this.store.dispatch(
            WorkspaceActions.setApiDocsVisibility({ visible: storedVisible === 'true' }),
          );
        }
        if (storedHeight !== null) {
          this.store.dispatch(
            WorkspaceActions.resizeApiDocsPane({ height: parseInt(storedHeight, 10) }),
          );
        }

        return { type: '[Workspace] Init Docs State Complete' };
      }),
    ),
  );

  /**
   * Sync API Docs visibility to localStorage.
   */
  syncApiDocsVisibility$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(WorkspaceActions.toggleApiDocsPane, WorkspaceActions.setApiDocsVisibility),
        withLatestFrom(this.store.select(selectIsApiDocsVisible)),
        tap(([_, isVisible]) => {
          localStorage.setItem('apiDocsVisible', String(isVisible));
        }),
      ),
    { dispatch: false },
  );

  /**
   * Sync API Docs pane height to localStorage.
   */
  syncApiDocsHeight$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(WorkspaceActions.resizeApiDocsPane),
        withLatestFrom(this.store.select(selectApiDocsPaneHeight)),
        tap(([_, height]) => {
          localStorage.setItem('apiDocsPaneHeight', String(height));
        }),
      ),
    { dispatch: false },
  );
}
