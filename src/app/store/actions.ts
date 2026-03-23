import { createAction, props } from '@ngrx/store';
import { GeneratedFile } from '../services/wasm-worker.service';
import { LayoutOrientation } from './state';
import { Target, LanguageOptions, InputFormat } from '../models/types';

/** Toggles the split pane layout orientation. */
export const toggleOrientation = createAction('[Workspace] Toggle Orientation');

/** Sets the layout orientation explicitly. */
export const setOrientation = createAction(
  '[Workspace] Set Orientation',
  props<{ orientation: LayoutOrientation }>(),
);

/** Sets the currently selected language ID. */
export const setSelectedLanguage = createAction(
  '[Workspace] Set Selected Language',
  props<{ languageId: string }>(),
);

/** Sets the generation target globally. */
export const setTarget = createAction(
  '[Workspace] Set Target',
  props<{ target: Target }>(),
);

/** Sets additional options for a specific language. */
export const setLanguageOptions = createAction(
  '[Workspace] Set Language Options',
  props<{ languageId: string; options: LanguageOptions }>(),
);

/** Updates the OpenAPI specification content. */
export const updateOpenApiSpec = createAction(
  '[OpenAPI] Update Spec Content',
  props<{ content: string }>(),
);

/** Sets OpenAPI validation errors. */
export const setOpenApiValidationErrors = createAction(
  '[OpenAPI] Set Validation Errors',
  props<{ errors: string[] }>(),
);

/** Selects a file to view in the code viewer. */
export const selectFile = createAction(
  '[FileTree] Select File',
  props<{ filePath: string }>(),
);

/** Sets the generated files in the tree. */
export const setGeneratedFiles = createAction(
  '[FileTree] Set Generated Files',
  props<{ files: GeneratedFile[] }>(),
);

/** Triggers the execution of WASM generation (from_openapi or to_openapi based on layout). */
export const executeRun = createAction('[Workspace] Execute Run');

/** Dispatched when WASM execution starts. */
export const executeRunStart = createAction('[Workspace] Execute Run Start');

/** Dispatched when WASM execution completes successfully. */
export const executeRunSuccess = createAction(
  '[Workspace] Execute Run Success',
  props<{ result: string | GeneratedFile[] }>(),
);

/** Dispatched when WASM execution fails. */
export const executeRunFailure = createAction(
  '[Workspace] Execute Run Failure',
  props<{ error: string }>(),
);

/** Sets the input format. */
export const setInputFormat = createAction(
  '[OpenAPI] Set Input Format',
  props<{ format: InputFormat }>()
);
