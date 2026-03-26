import { createAction, props } from '@ngrx/store';
import { GeneratedFile } from '../services/wasm-worker.service';
import { LayoutOrientation } from './state';
import { Target, LanguageOptions, InputFormat } from '../models/types';

/** Toggles the split pane layout orientation. */
/** Toggles the workspace orientation. */
export const toggleOrientation = createAction('[Workspace] Toggle Orientation');

/** Sets the layout orientation explicitly. */
/** Sets the workspace orientation. */
export const setOrientation = createAction(
  '[Workspace] Set Orientation',
  /** props */
  props<{ orientation: LayoutOrientation }>(),
);

/** Sets the currently selected language ID. */
export const setSelectedLanguage = createAction(
  '[Workspace] Set Selected Language',
  /** props */
  props<{ languageId: string }>(),
);

/** Sets the generation target globally. */
/** Sets the target. */
export const setTarget = createAction('[Workspace] Set Target', props<{ target: Target }>());

/** Sets additional options for a specific language. */
/** Sets the language options. */
export const setLanguageOptions = createAction(
  '[Workspace] Set Language Options',
  /** props */
  props<{ languageId: string; options: LanguageOptions }>(),
);

/** Updates the OpenAPI specification content. */
export const updateOpenApiSpec = createAction(
  '[OpenAPI] Update Spec Content',
  /** props */
  props<{ content: string }>(),
);

/** Sets OpenAPI validation errors. */
export const setOpenApiValidationErrors = createAction(
  '[OpenAPI] Set Validation Errors',
  /** props */
  props<{ errors: string[] }>(),
);

/** Selects a file to view in the code viewer. */
/** Selects a file. */
export const selectFile = createAction('[FileTree] Select File', props<{ filePath: string }>());

/** Sets the generated files in the tree. */
/** Sets the generated files. */
export const setGeneratedFiles = createAction(
  '[FileTree] Set Generated Files',
  /** props */
  props<{ files: GeneratedFile[] }>(),
);

/** Triggers the execution of WASM generation (from_openapi or to_openapi based on layout). */
export const executeRun = createAction('[Workspace] Execute Run');

/** Dispatched when WASM execution starts. */
export const executeRunStart = createAction('[Workspace] Execute Run Start');

/** Dispatched when WASM execution completes successfully. */
/** Fired when execution is successful. */
export const executeRunSuccess = createAction(
  '[Workspace] Execute Run Success',
  /** props */
  props<{ result: string | GeneratedFile[] }>(),
);

/** Dispatched when WASM execution fails. */
/** Fired when execution fails. */
export const executeRunFailure = createAction(
  '[Workspace] Execute Run Failure',
  /** props */
  props<{ error: string }>(),
);

/** Sets the input format. */
export const setInputFormat = createAction(
  '[OpenAPI] Set Input Format',
  /** props */
  props<{ format: InputFormat }>(),
);

// API Docs Actions
/** Toggles the API Docs pane. */
export const toggleApiDocsPane = createAction('[Workspace] Toggle API Docs Pane');
/** Sets the API Docs visibility. */
export const setApiDocsVisibility = createAction(
  '[Workspace] Set API Docs Visibility',
  /** props */
  props<{ visible: boolean }>(),
);
/** Resizes the API Docs pane. */
export const resizeApiDocsPane = createAction(
  '[Workspace] Resize Bottom Pane',
  /** props */
  props<{ height: number }>(),
);
/** Fired when API Docs iframe is loaded. */
export const apiDocsIframeLoaded = createAction('[ApiDocs] Iframe Loaded Successfully');
/** Fired when API Docs iframe fails to load. */
export const apiDocsIframeLoadFailed = createAction(
  '[ApiDocs] Iframe Load Failed',
  /** props */
  props<{ error: string }>(),
);
