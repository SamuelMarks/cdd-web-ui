/**
 * Root NgRx store reducer map.
 * @module app/store/index
 */
import { ActionReducerMap } from '@ngrx/store';
import { AppState } from './state';
import { workspaceReducer, fileTreeReducer, openApiReducer } from './reducers';

/**
 * Global application reducer map.
 */
export const reducers: ActionReducerMap<AppState> = {
  /** workspace */
  workspace: workspaceReducer,
  /** fileTree */
  fileTree: fileTreeReducer,
  /** openApi */
  openApi: openApiReducer,
};
