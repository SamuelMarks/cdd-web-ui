import { createReducer, on } from '@ngrx/store';
import { WorkspaceState, FileTreeState, OpenApiState, LayoutOrientation } from './state';
import * as Actions from './actions';
import { PETSTORE_SPEC } from '../models/examples';

/** Initial state for the Workspace. */
export const initialWorkspaceState: WorkspaceState = {
  orientation: 'openapi-left',
  isExecuting: false,
  selectedLanguageId: 'c',
};

/** Workspace Reducer */
export const workspaceReducer = createReducer(
  initialWorkspaceState,
  on(Actions.toggleOrientation, (state): WorkspaceState => ({
    ...state,
    orientation: state.orientation === 'openapi-left' ? 'openapi-right' : 'openapi-left',
  })),
  on(Actions.setOrientation, (state, { orientation }): WorkspaceState => ({
    ...state,
    orientation,
  })),
  on(Actions.setSelectedLanguage, (state, { languageId }): WorkspaceState => ({
    ...state,
    selectedLanguageId: languageId,
  })),
  on(Actions.executeRunStart, (state): WorkspaceState => ({
    ...state,
    isExecuting: true,
  })),
  on(Actions.executeRunSuccess, Actions.executeRunFailure, (state): WorkspaceState => ({
    ...state,
    isExecuting: false,
  })),
);

/** Initial state for the File Tree. */
export const initialFileTreeState: FileTreeState = {
  files: [],
  activeFilePath: null,
};

/** File Tree Reducer */
export const fileTreeReducer = createReducer(
  initialFileTreeState,
  on(Actions.setGeneratedFiles, (state, { files }): FileTreeState => ({
    ...state,
    files,
    activeFilePath: files.length > 0 ? files[0].path : null,
  })),
  on(Actions.selectFile, (state, { filePath }): FileTreeState => ({
    ...state,
    activeFilePath: filePath,
  })),
);

/** Initial state for OpenAPI. */
export const initialOpenApiState: OpenApiState = {
  specContent: PETSTORE_SPEC,
  validationErrors: [],
};

/** OpenAPI Reducer */
export const openApiReducer = createReducer(
  initialOpenApiState,
  on(Actions.updateOpenApiSpec, (state, { content }): OpenApiState => ({
    ...state,
    specContent: content,
  })),
  on(Actions.setOpenApiValidationErrors, (state, { errors }): OpenApiState => ({
    ...state,
    validationErrors: errors,
  })),
);
