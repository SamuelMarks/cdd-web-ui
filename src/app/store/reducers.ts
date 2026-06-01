import { createReducer, on } from '@ngrx/store';
import { WorkspaceState, FileTreeState, OpenApiState } from './state';
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
  on(Actions.setSelectedLanguage, (state, { languageId }): WorkspaceState => {
    const currentLanguageId = state.selectedLanguageId;
    const currentOptions = state.languageOptions[currentLanguageId] || {};
    const newOptions = { ...(state.languageOptions[languageId] || {}) };

    const sharedKeys = ['tests', 'noGithubActions', 'noInstallablePackage'];
    for (const key of sharedKeys) {
      if (currentOptions[key] !== undefined) {
        newOptions[key] = currentOptions[key];
      }
    }

    return {
      ...state,
      selectedLanguageId: languageId,
      languageOptions: {
        ...state.languageOptions,
        [languageId]: newOptions,
      },
      executionError: null,
    };
  }),
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
  on(
    Actions.setSelectedLanguage,
    (state): FileTreeState => ({
      ...state,
      files: [],
      activeFilePath: null,
    }),
  ),
  /** on */
  on(Actions.setGeneratedFiles, (state, { files, modelNames }): FileTreeState => {
    let activeFilePath: string | null = null;
    if (files.length > 0) {
      // Filter out manifest/config files so we prefer actual source code
      const ignorePatterns = [
        /package\.swift$/i,
        /package\.json$/i,
        /package-lock\.json$/i,
        /cargo\.toml$/i,
        /cargo\.lock$/i,
        /go\.mod$/i,
        /go\.sum$/i,
        /composer\.json$/i,
        /composer\.lock$/i,
        /gemfile$/i,
        /gemfile\.lock$/i,
        /cmakelists\.txt$/i,
        /pom\.xml$/i,
        /build\.gradle$/i,
        /tsconfig\.json$/i,
      ];

      const candidateFiles = files.filter((f) => !ignorePatterns.some((p) => p.test(f.path)));
      const searchFiles = candidateFiles.length > 0 ? candidateFiles : files;

      // 1. Try to find a file containing a model definition based on parsed OpenAPI models
      if (modelNames && modelNames.length > 0) {
        // Escape model names for regex
        const escapedNames = modelNames
          .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        const modelContentPatterns = [
          new RegExp(`(?:class|struct|interface|type)\\s+(?:${escapedNames})\\b`, 'i'),
          new RegExp(`def\\s+(?:${escapedNames})\\b`, 'i'), // Python dataclass/function fallback
          new RegExp(`type\\s+(?:${escapedNames})\\s+struct`, 'i'), // Go structs
          new RegExp(`pub\\s+struct\\s+(?:${escapedNames})\\b`, 'i'), // Rust structs
        ];

        for (const pattern of modelContentPatterns) {
          const match = searchFiles.find(
            (f) => f.content && pattern.test(new TextDecoder().decode(f.content)),
          );
          if (match) {
            activeFilePath = match.path;
            break;
          }
        }
      }

      // 2. Fall back to finding a file with any model definition (e.g. general fields fallback)
      if (!activeFilePath) {
        // Generic fallback for some common names just in case modelNames weren't provided or didn't match
        const genericModelContentPatterns = [
          /(?:class|struct|interface|type)\s+(?:Pet|User|Order|Error|Model)\b/i,
          /def\s+(?:Pet|User|Order|Error|Model)\b/i, // Python dataclass/function fallback
          /type\s+(?:Pet|User|Order|Error|Model)\s+struct/i, // Go structs
          /pub\s+struct\s+(?:Pet|User|Order|Error|Model)\b/i, // Rust structs
        ];

        for (const pattern of genericModelContentPatterns) {
          const match = searchFiles.find(
            (f) => f.content && pattern.test(new TextDecoder().decode(f.content)),
          );
          if (match) {
            activeFilePath = match.path;
            break;
          }
        }
      }

      // 3. Fall back to filename patterns
      if (!activeFilePath) {
        const patterns = [
          /readme\.md$/i,
          /models/i,
          /types/i,
          /client/i,
          /api/i,
          /index\./i,
          /main\./i,
          /\.ts$/,
          /\.py$/,
          /\.go$/,
          /\.rs$/,
          /\.cs$/,
          /\.java$/,
          /\.kt$/,
          /\.php$/,
          /\.rb$/,
          /\.swift$/,
          /\.cpp$/,
          /\.hpp$/,
          /\.c$/,
          /\.h$/,
          /\.sh$/,
        ];

        for (const pattern of patterns) {
          const match = searchFiles.find((f) => pattern.test(f.path));
          if (match) {
            activeFilePath = match.path;
            break;
          }
        }
      }

      // 3. Absolute fallback
      if (!activeFilePath) {
        activeFilePath = searchFiles[0].path;
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
