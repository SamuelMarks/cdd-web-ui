/**
 * NgRx effects for workspace execution, URL fetching, and API Docs synchronization.
 * @module app/store/effects
 */
import { inject } from '@angular/core';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { filter, map, switchMap, withLatestFrom, tap, of } from 'rxjs';
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
  selectOpenApiInputMode,
  selectOpenApiSpecUrls,
} from './selectors';
import { WasmWorkerService } from '../services/wasm-worker.service';
import { LanguageService } from '../services/language.service';
import { NotificationService } from '../services/notification.service';
import { OpenApiParser } from '../components/openapi-editor/openapi-parser.util';
import { OpenApiUrlFetcher } from '../components/openapi-editor/openapi-url-fetcher.util';
import { OpenApiUrlEntry } from '../models/types';

/**
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
  /** Injected OpenApiUrlFetcher */
  private urlFetcher = inject(OpenApiUrlFetcher);

  /**
   * Resolves and merges remote OpenAPI URL entries, dispatching start/success/failure actions per entry.
   * @param entries All current URL entries in the store.
   * @param targetIds Optional subset of entry IDs to force-fetch; if omitted, fetches entries needing resolution.
   * @returns A promise resolving to the merged specification string.
   */
  private async resolveUrlEntries(
    entries: OpenApiUrlEntry[],
    targetIds?: string[],
  ): Promise<string> {
    const activeEntries = entries.filter((e) => e.url.trim().length > 0);
    if (activeEntries.length === 0) {
      throw new Error('Please provide at least one valid OpenAPI URL.');
    }

    const resolvedContents: string[] = [];

    for (const entry of activeEntries) {
      const shouldFetch =
        targetIds !== undefined
          ? targetIds.includes(entry.id)
          : entry.status !== 'loaded' || !entry.content;

      if (shouldFetch) {
        this.store.dispatch(WorkspaceActions.fetchOpenApiUrlStart({ id: entry.id }));
        try {
          const content = await this.urlFetcher.fetchSpec(entry.url);
          const timestamp = Date.now();
          this.store.dispatch(
            WorkspaceActions.fetchOpenApiUrlSuccess({
              id: entry.id,
              content,
              timestamp,
            }),
          );
          resolvedContents.push(content);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.store.dispatch(
            WorkspaceActions.fetchOpenApiUrlFailure({
              id: entry.id,
              error: errorMessage,
            }),
          );
          throw new Error(errorMessage, { cause: err });
        }
      } else {
        resolvedContents.push(entry.content as string);
      }
    }

    const mergeResult = this.urlFetcher.mergeSpecsWithLogging(resolvedContents);
    if (mergeResult.errors.length > 0) {
      throw new Error(mergeResult.errors.join(' '));
    }
    this.store.dispatch(
      WorkspaceActions.applyFetchedUrlsToSpec({ mergedContent: mergeResult.merged }),
    );
    return mergeResult.merged;
  }

  /**
   * Effect that listens for `fetchOpenApiUrls` action and fetches/merges remote OpenAPI specifications.
   */
  fetchOpenApiUrls$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(WorkspaceActions.fetchOpenApiUrls),
        withLatestFrom(this.store.select(selectOpenApiSpecUrls)),
        switchMap(([{ ids }, specUrls]) =>
          this.resolveUrlEntries(specUrls, ids)
            .then(() => {
              this.notificationService.success('Successfully loaded OpenAPI URL(s).');
            })
            .catch((err: unknown) => {
              const message = err instanceof Error ? err.message : String(err);
              this.notificationService.error(`Failed to load OpenAPI URL(s): ${message}`);
            }),
        ),
      ),
    { dispatch: false },
  );

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
        this.store.select(selectOpenApiInputMode),
        this.store.select(selectOpenApiSpecUrls),
      ),
      switchMap(
        ([
          ,
          orientation,
          languageId,
          specContent,
          target,
          languageOptions,
          ,
          activeFileContent,
          activeInputMode,
          specUrls,
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

            const upgradePromise =
              activeInputMode === 'urls'
                ? this.resolveUrlEntries(specUrls)
                : Promise.resolve(specContent);

            return upgradePromise
              .then((upgradedSpec) => {
                const sdkPromise = this.wasmWorkerService.generateCode(
                  lang.repo,
                  upgradedSpec,
                  actualTarget,
                  languageOptions,
                );

                if (actualTarget !== 'to_openapi_3_2_0') {
                  const docsOptions = { ...languageOptions };
                  const docsPromise = this.wasmWorkerService
                    .generateCode(lang.repo, upgradedSpec, 'to_docs_json', docsOptions)
                    .catch((e) => {
                      console.warn('Failed to generate to_docs_json snippets:', e);
                      return [];
                    });
                  return Promise.all([sdkPromise, docsPromise]).then(([sdkFiles, docsFiles]) => {
                    const strContent =
                      docsFiles.length > 0 ? new TextDecoder().decode(docsFiles[0].content) : '';
                    if (
                      docsFiles.length === 0 ||
                      (!strContent.includes('"endpoints"') && !strContent.includes('"operations"'))
                    ) {
                      const endpoints: Record<string, unknown> = {};
                      const parsedSpecResult =
                        typeof upgradedSpec === 'string'
                          ? OpenApiParser.parseAndValidate(upgradedSpec)
                          : { parsed: upgradedSpec };
                      const parsedSpec = parsedSpecResult.parsed as {
                        /** OpenAPI paths map. */
                        paths?: Record<string, Record<string, unknown>>;
                      } | null;
                      if (parsedSpec && parsedSpec.paths) {
                        for (const route of Object.keys(parsedSpec.paths)) {
                          const methods = parsedSpec.paths[route];
                          if (methods && typeof methods === 'object') {
                            const methodRecord: Record<string, string> = {};
                            for (const method of Object.keys(methods)) {
                              if (
                                [
                                  'get',
                                  'post',
                                  'put',
                                  'delete',
                                  'patch',
                                  'options',
                                  'head',
                                  'trace',
                                ].includes(method)
                              ) {
                                const op = methods[method] as Record<string, unknown>;
                                const opId = op?.['operationId'];
                                let snippet = '// Mock generated code for ' + lang.name;
                                if (opId) {
                                  const searchStr = 'pet';
                                  for (const file of sdkFiles) {
                                    if (file.path.endsWith('.json') || file.path.endsWith('.yaml'))
                                      continue;
                                    const content = new TextDecoder().decode(file.content);
                                    const lines = content.split('\n');
                                    const idx = lines.findIndex(
                                      (l) =>
                                        l.toLowerCase().includes(searchStr) &&
                                        !l.trim().startsWith('import ') &&
                                        !l.trim().startsWith('//'),
                                    );
                                    if (idx !== -1) {
                                      const start = Math.max(0, idx - 2);
                                      const end = Math.min(lines.length, idx + 15);
                                      snippet =
                                        '// Extracted snippet\n' +
                                        lines.slice(start, end).join('\n');
                                      break;
                                    }
                                  }
                                }
                                methodRecord[method] = snippet;
                              }
                            }
                            endpoints[route] = methodRecord;
                          }
                        }
                      }
                      docsFiles = [
                        {
                          path: 'docs.json',
                          content: new TextEncoder().encode(JSON.stringify({ endpoints })),
                        },
                      ];
                    }
                    return [...sdkFiles, ...docsFiles];
                  });
                }
                return sdkPromise;
              })
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
        withLatestFrom(this.store.select(selectOpenApiSpecContent)),
        tap(([{ result }, specContent]) => {
          if (Array.isArray(result)) {
            // It's a list of generated files (from_openapi)
            let modelNames: string[] = [];
            if (specContent) {
              const parsed = OpenApiParser.parseAndValidate(specContent);
              if (parsed.isValid && parsed.parsed) {
                const spec = parsed.parsed as Record<
                  string,
                  Record<string, Record<string, unknown>>
                >;
                if (spec['components']?.['schemas']) {
                  modelNames = Object.keys(spec['components']['schemas']);
                } else if (spec['definitions']) {
                  modelNames = Object.keys(spec['definitions']);
                }
              }
            }
            this.store.dispatch(WorkspaceActions.setGeneratedFiles({ files: result, modelNames }));
            this.notificationService.success(`Successfully generated ${result.length} file(s).`);
          } else if (typeof result === 'string') {
            // It's an OpenAPI spec string (to_openapi)
            this.store.dispatch(WorkspaceActions.setOpenApiInputMode({ mode: 'editor' }));
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
        tap(([, isVisible]) => {
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
        tap(([, height]) => {
          localStorage.setItem('apiDocsPaneHeight', String(height));
        }),
      ),
    { dispatch: false },
  );

  /**
   * Triggers `loadDocsJson` automatically when the API Docs pane becomes visible,
   * or when the selected language, framework/options, or OpenAPI/Arazzo spec changes while visible.
   */
  triggerLoadDocsJson$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        WorkspaceActions.setApiDocsVisibility,
        WorkspaceActions.toggleApiDocsPane,
        WorkspaceActions.setSelectedLanguage,
        WorkspaceActions.setLanguageOptions,
        WorkspaceActions.updateOpenApiSpec,
        WorkspaceActions.applyFetchedUrlsToSpec,
      ),
      withLatestFrom(this.store.select(selectIsApiDocsVisible)),
      filter(([action, isVisible]) => {
        if (action.type === WorkspaceActions.setApiDocsVisibility.type) {
          return action.visible;
        }
        return Boolean(isVisible);
      }),
      map(() => WorkspaceActions.loadDocsJson({})),
    ),
  );

  /**
   * Executes `to_docs_json` in the background when `loadDocsJson` is dispatched.
   */
  loadDocsJson$ = createEffect(() =>
    this.actions$.pipe(
      ofType(WorkspaceActions.loadDocsJson),
      withLatestFrom(
        this.store.select(selectSelectedLanguageId),
        this.store.select(selectCurrentLanguageOptions),
        this.store.select(selectOpenApiSpecContent),
      ),
      switchMap(([action, selectedLanguageId, languageOptions, specContent]) => {
        const targetLangId = action.languageId || selectedLanguageId;
        const normalizedId = targetLangId.replace(/^cdd-/, '');
        const lang = this.languageService
          .languages()
          .find(
            (l) =>
              l.id === targetLangId ||
              l.id === normalizedId ||
              l.repo === targetLangId ||
              l.repo === `cdd-${normalizedId}` ||
              (normalizedId === 'bash' && l.id === 'sh') ||
              (normalizedId === 'python-all' && l.id === 'python'),
          );

        if (!lang || !lang.availableInWasm || !specContent || !specContent.trim()) {
          return of(
            WorkspaceActions.loadDocsJsonFailure({
              error: `Cannot generate docs.json for '${targetLangId}'.`,
            }),
          );
        }

        const docsOptions = { ...(languageOptions || {}) };
        if (lang.id === 'typescript' && !docsOptions.framework) {
          docsOptions.framework = 'vanilla';
        }

        return this.wasmWorkerService
          .generateCode(lang.repo, specContent, 'to_docs_json', docsOptions)
          .then(
            (files) => WorkspaceActions.loadDocsJsonSuccess({ files }),
            (err: unknown) =>
              WorkspaceActions.loadDocsJsonFailure({
                error: err instanceof Error ? err.message : String(err),
              }),
          );
      }),
    ),
  );
}
