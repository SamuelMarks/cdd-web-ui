import { createReducer, on } from '@ngrx/store';
import { WorkspaceState, FileTreeState, OpenApiState, LayoutOrientation } from './state';
import * as Actions from './actions';
import { PETSTORE_SPEC } from '../models/examples';

/** Initial state for the Workspace. */
export const initialWorkspaceState: WorkspaceState = {
  /** orientation */
  orientation: 'openapi-left',
  /** isExecuting */
  isExecuting: false,
  /** selectedLanguageId */
  selectedLanguageId: 'c',
  /** target */
  target: 'to_sdk',
  /** languageOptions */
  languageOptions: {},
  /** isApiDocsVisible */
  isApiDocsVisible: false,
  /** apiDocsPaneHeight */
  apiDocsPaneHeight: 300,
  /** apiDocsLoadState */
  apiDocsLoadState: 'IDLE',
  /** executionError */
  executionError: null,
};

/** Workspace Reducer */
export const workspaceReducer = createReducer(
  initialWorkspaceState,
  /** on */
  on(
    Actions.toggleOrientation,
    (state): WorkspaceState => ({
      ...state,
      orientation: state.orientation === 'openapi-left' ? 'openapi-right' : 'openapi-left',
    }),
  ),
  /** on */
  on(
    Actions.setOrientation,
    (state, { orientation }): WorkspaceState => ({
      ...state,
      orientation,
    }),
  ),
  /** on */
  on(
    Actions.setSelectedLanguage,
    (state, { languageId }): WorkspaceState => ({
      ...state,
      selectedLanguageId: languageId,
      executionError: null,
    }),
  ),
  /** on */
  on(
    Actions.setTarget,
    (state, { target }): WorkspaceState => ({
      ...state,
      target,
      executionError: null,
    }),
  ),
  /** on */
  on(
    Actions.setLanguageOptions,
    (state, { languageId, options }): WorkspaceState => ({
      ...state,
      languageOptions: {
        ...state.languageOptions,
        [languageId]: options,
      },
      executionError: null,
    }),
  ),
  /** on */
  on(
    Actions.executeRunStart,
    (state): WorkspaceState => ({
      ...state,
      isExecuting: true,
      executionError: null,
    }),
  ),
  /** on */
  on(
    Actions.executeRunSuccess,
    (state): WorkspaceState => ({
      ...state,
      isExecuting: false,
      executionError: null,
    }),
  ),
  /** on */
  on(
    Actions.executeRunFailure,
    (state, { error }): WorkspaceState => ({
      ...state,
      isExecuting: false,
      executionError: error,
    }),
  ),
  /** on */
  on(
    Actions.updateOpenApiSpec,
    (state): WorkspaceState => ({
      ...state,
      executionError: null,
    }),
  ),

  /** on */
  on(
    Actions.toggleApiDocsPane,
    (state): WorkspaceState => ({
      ...state,
      isApiDocsVisible: !state.isApiDocsVisible,
    }),
  ),
  /** on */
  on(
    Actions.setApiDocsVisibility,
    (state, { visible }): WorkspaceState => ({
      ...state,
      isApiDocsVisible: visible,
      apiDocsLoadState:
        visible && state.apiDocsLoadState === 'IDLE' ? 'LOADING' : state.apiDocsLoadState,
    }),
  ),
  /** on */
  on(
    Actions.resizeApiDocsPane,
    (state, { height }): WorkspaceState => ({
      ...state,
      apiDocsPaneHeight: height,
    }),
  ),
  /** on */
  on(
    Actions.apiDocsIframeLoaded,
    (state): WorkspaceState => ({
      ...state,
      apiDocsLoadState: 'LOADED',
    }),
  ),
  /** on */
  on(
    Actions.apiDocsIframeLoadFailed,
    (state): WorkspaceState => ({
      ...state,
      apiDocsLoadState: 'ERROR',
    }),
  ),
);

/** Initial state for the File Tree. */
export const initialFileTreeState: FileTreeState = {
  /** files */
  files: [],
  /** activeFilePath */
  activeFilePath: null,
};

/** File Tree Reducer */
export const fileTreeReducer = createReducer(
  initialFileTreeState,
  /** on */
  on(Actions.setGeneratedFiles, (state, { files }): FileTreeState => {
    let activeFilePath: string | null = null;
    if (files.length > 0) {
      const patterns = [
        /readme\.md$/i,
        /client\./i,
        /api\./i,
        /index\./i,
        /main\./i,
        /\.ts$/,
        /\.py$/,
        /\.go$/,
        /\.rs$/,
      ];

      for (const pattern of patterns) {
        const match = files.find((f) => pattern.test(f.path));
        if (match) {
          activeFilePath = match.path;
          break;
        }
      }

      if (!activeFilePath) {
        activeFilePath = files[0].path;
      }
    }

    return {
      ...state,
      files,
      activeFilePath,
    };
  }),
  /** on */
  on(
    Actions.selectFile,
    (state, { filePath }): FileTreeState => ({
      ...state,
      activeFilePath: filePath,
    }),
  ),
);

/** Initial state for OpenAPI. */
export const initialOpenApiState: OpenApiState = {
  /** specContent */
  specContent: PETSTORE_SPEC,
  /** validationErrors */
  validationErrors: [],
  /** inputFormat */
  inputFormat: 'openapi_3_2_0',
};

/** OpenAPI Reducer */
export const openApiReducer = createReducer(
  initialOpenApiState,
  /** on */
  on(
    Actions.updateOpenApiSpec,
    (state, { content }): OpenApiState => ({
      ...state,
      specContent: content,
    }),
  ),
  /** on */
  on(
    Actions.setOpenApiValidationErrors,
    (state, { errors }): OpenApiState => ({
      ...state,
      validationErrors: errors,
    }),
  ),
  /** on */
  on(
    Actions.setInputFormat,
    (state, { format }): OpenApiState => ({
      ...state,
      inputFormat: format,
    }),
  ),
);
