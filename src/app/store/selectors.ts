/**
 * NgRx selectors for workspace, file tree, and OpenAPI state slices.
 * @module app/store/selectors
 */
import { createSelector } from '@ngrx/store';
import { AppState, WorkspaceState, FileTreeState, OpenApiState } from './state';
import { GeneratedFile } from '../services/wasm-worker.service';

/**
 * Feature selector for Workspace State.
 * @param state The root application state.
 * @returns The workspace state slice.
 */
export const selectWorkspaceFeature = (state: AppState): WorkspaceState => state.workspace;

/**
 * Feature selector for File Tree State.
 * @param state The root application state.
 * @returns The file tree state slice.
 */
export const selectFileTreeFeature = (state: AppState): FileTreeState => state.fileTree;

/**
 * Feature selector for OpenAPI State.
 * @param state The root application state.
 * @returns The OpenAPI state slice.
 */
export const selectOpenApiFeature = (state: AppState): OpenApiState => state.openApi;

// --- Workspace Selectors ---

/** Selects the current layout orientation */
export const selectOrientation = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState) => state.orientation,
);

/** Selects the isExecuting flag */
export const selectIsExecuting = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState) => state.isExecuting,
);

/** Selects the execution error */
export const selectExecutionError = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState) => state.executionError,
);

/** Selects whether the application is in online mode */
export const selectIsOnlineMode = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState) => state.isOnlineMode,
);

/** Selects the currently selected language ID */
export const selectSelectedLanguageId = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState) => state.selectedLanguageId,
);

/** Selects the current generation target */
export const selectTarget = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState) => state.target,
);

/** Selects all language options */
export const selectAllLanguageOptions = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState) => state.languageOptions,
);

/** Selects options for the currently selected language */
export const selectCurrentLanguageOptions = createSelector(
  selectSelectedLanguageId,
  selectAllLanguageOptions,
  (langId, options) => options[langId] || {},
);

// --- File Tree Selectors ---

/** Selects all generated files */
export const selectGeneratedFiles = createSelector(
  selectFileTreeFeature,
  (state: FileTreeState) => state.files,
);

/** Selects the active file path */
export const selectActiveFilePath = createSelector(
  selectFileTreeFeature,
  (state: FileTreeState) => state.activeFilePath,
);

/** Selects the active file content based on the active path */
export const selectActiveFileContent = createSelector(
  selectGeneratedFiles,
  selectActiveFilePath,
  (files: GeneratedFile[], activePath: string | null) => {
    if (!activePath) return null;
    const file = files.find((f) => f.path === activePath);
    if (!file) return null;
    return new TextDecoder().decode(file.content);
  },
);

// --- OpenAPI Selectors ---

/** Selects the OpenAPI specification content */
export const selectOpenApiSpecContent = createSelector(
  selectOpenApiFeature,
  (state: OpenApiState) => state.specContent,
);

/** Selects the OpenAPI validation errors */
export const selectOpenApiValidationErrors = createSelector(
  selectOpenApiFeature,
  (state: OpenApiState) => state.validationErrors,
);

/** Selects the OpenAPI input format */
export const selectOpenApiInputFormat = createSelector(
  selectOpenApiFeature,
  (state: OpenApiState) => state.inputFormat,
);

/** Selects the active input mode tab in the OpenAPI pane ('editor' or 'urls') */
export const selectOpenApiInputMode = createSelector(
  selectOpenApiFeature,
  (state: OpenApiState) => state.activeInputMode,
);

/** Selects the list of remote OpenAPI specification URL entries */
export const selectOpenApiSpecUrls = createSelector(
  selectOpenApiFeature,
  (state: OpenApiState) => state.specUrls,
);

/** Selects whether one or more remote OpenAPI URLs are currently being fetched */
export const selectIsFetchingOpenApiUrls = createSelector(
  selectOpenApiFeature,
  (state: OpenApiState) => state.isFetchingUrls,
);

/** Selects the count of non-empty remote OpenAPI URL entries */
export const selectValidOpenApiUrlCount = createSelector(
  selectOpenApiSpecUrls,
  (urls) => urls.filter((entry) => entry.url.trim().length > 0).length,
);

/** Selects all error messages from remote OpenAPI URL entries */
export const selectOpenApiUrlErrors = createSelector(selectOpenApiSpecUrls, (urls) =>
  urls.filter((entry) => Boolean(entry.error)).map((entry) => entry.error as string),
);

// API Docs Selectors
/** Selects whether the API Docs pane is visible. */
export const selectIsApiDocsVisible = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState) => state.isApiDocsVisible,
);

/** Selects the height of the API Docs pane. */
export const selectApiDocsPaneHeight = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState) => state.apiDocsPaneHeight,
);

/** Selects the loading state of the API Docs pane. */
export const selectApiDocsLoadState = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState) => state.apiDocsLoadState,
);

/** Selects the language ID that produced the workspace docs.json files. */
export const selectDocsJsonLanguageId = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState | undefined): string | undefined => state?.docsJsonLanguageId,
);

/** Selects the dedicated docs.json files stored in the workspace state. */
export const selectDocsJsonFiles = createSelector(
  selectWorkspaceFeature,
  (state: WorkspaceState | undefined): GeneratedFile[] => {
    if (!state?.docsJsonFiles) {
      return [];
    }
    if (state.docsJsonLanguageId && state.docsJsonLanguageId !== state.selectedLanguageId) {
      return [];
    }
    return state.docsJsonFiles;
  },
);

/** Selects concise `to_docs_json` files (preferring dedicated workspace docsJsonFiles, then docs.json entries in generatedFiles). */
export const selectDocsJsonExamples = createSelector(
  selectDocsJsonFiles,
  selectGeneratedFiles,
  (docsJsonFiles: GeneratedFile[], generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    if (docsJsonFiles.length > 0) {
      return docsJsonFiles;
    }
    return generatedFiles.filter(
      (f: GeneratedFile): boolean => f.path === 'docs.json' || f.path.endsWith('/docs.json'),
    );
  },
);
