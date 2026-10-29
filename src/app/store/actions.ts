/**
 * NgRx actions for workspace, file tree, OpenAPI, and API Docs state transitions.
 * @module app/store/actions
 */
import { createAction, props } from '@ngrx/store';
import { GeneratedFile } from '../services/wasm-worker.service';
import { LayoutOrientation } from './state';
import { Target, LanguageOptions, InputFormat, OpenApiInputMode } from '../models/types';

/** Toggles the split pane layout orientation. */
export const toggleOrientation = createAction('[Workspace] Toggle Orientation');

/** Sets the layout orientation explicitly. */
export const setOrientation = createAction(
  '[Workspace] Set Orientation',
  /** props */
  props<{
    /** Target layout orientation. */
    orientation: LayoutOrientation;
  }>(),
);

/** Sets the currently selected language ID. */
export const setSelectedLanguage = createAction(
  '[Workspace] Set Selected Language',
  /** props */
  props<{
    /** ID of the selected programming language. */
    languageId: string;
  }>(),
);

/** Sets the generation target globally. */
export const setTarget = createAction(
  '[Workspace] Set Target',
  props<{
    /** Target generation format. */
    target: Target;
  }>(),
);

/** Sets additional options for a specific language. */
export const setLanguageOptions = createAction(
  '[Workspace] Set Language Options',
  /** props */
  props<{
    /** ID of the target language. */
    languageId: string;
    /** Language-specific generation options. */
    options: LanguageOptions;
  }>(),
);

/** Updates the OpenAPI specification content. */
export const updateOpenApiSpec = createAction(
  '[OpenAPI] Update Spec Content',
  /** props */
  props<{
    /** Updated OpenAPI specification string. */
    content: string;
  }>(),
);

/** Sets OpenAPI validation errors. */
export const setOpenApiValidationErrors = createAction(
  '[OpenAPI] Set Validation Errors',
  /** props */
  props<{
    /** Validation error messages. */
    errors: string[];
  }>(),
);

/** Selects a file to view in the code viewer. */
export const selectFile = createAction(
  '[FileTree] Select File',
  props<{
    /** Path of the selected file. */
    filePath: string;
  }>(),
);

/** Updates the content of the currently active file. */
export const updateActiveFileContent = createAction(
  '[FileTree] Update Active File Content',
  props<{
    /** New file content string. */
    content: string;
  }>(),
);

/** Sets the generated files in the tree. */
export const setGeneratedFiles = createAction(
  '[FileTree] Set Generated Files',
  /** props */
  props<{
    /** Array of generated files. */
    files: GeneratedFile[];
    /** Optional list of schema model names extracted from the spec. */
    modelNames?: string[];
  }>(),
);

/** Triggers the execution of WASM generation (from_openapi or to_openapi based on layout). */
export const executeRun = createAction('[Workspace] Execute Run');

/** Dispatched when WASM execution starts. */
export const executeRunStart = createAction('[Workspace] Execute Run Start');

/** Dispatched when WASM execution completes successfully. */
export const executeRunSuccess = createAction(
  '[Workspace] Execute Run Success',
  /** props */
  props<{
    /** Generated OpenAPI string or list of generated files. */
    result: string | GeneratedFile[];
  }>(),
);

/** Dispatched when WASM execution fails. */
export const executeRunFailure = createAction(
  '[Workspace] Execute Run Failure',
  /** props */
  props<{
    /** Execution error message. */
    error: string;
  }>(),
);

/** Sets whether the workspace is operating in online mode. */
export const setOnlineMode = createAction(
  '[Workspace] Set Online Mode',
  props<{
    /** True if online mode is active. */
    isOnlineMode: boolean;
  }>(),
);

/** Sets the input format. */
export const setInputFormat = createAction(
  '[OpenAPI] Set Input Format',
  /** props */
  props<{
    /** Input specification format. */
    format: InputFormat;
  }>(),
);

/** Sets the active input mode tab in the OpenAPI pane ('editor' or 'urls'). */
export const setOpenApiInputMode = createAction(
  '[OpenAPI] Set Input Mode',
  /** props */
  props<{
    /** Active OpenAPI input mode. */
    mode: OpenApiInputMode;
  }>(),
);

/** Appends a new remote URL entry to the OpenAPI URLs list. */
export const addOpenApiUrl = createAction(
  '[OpenAPI] Add URL',
  /** props */
  props<{
    /** Optional initial URL string. */
    url?: string;
    /** Optional explicit entry ID. */
    id?: string;
  }>(),
);

/** Updates the URL string of an existing OpenAPI URL entry. */
export const updateOpenApiUrl = createAction(
  '[OpenAPI] Update URL',
  /** props */
  props<{
    /** ID of the URL entry to update. */
    id: string;
    /** Updated URL string. */
    url: string;
  }>(),
);

/** Removes an OpenAPI URL entry by its ID. */
export const removeOpenApiUrl = createAction(
  '[OpenAPI] Remove URL',
  /** props */
  props<{
    /** ID of the URL entry to remove. */
    id: string;
  }>(),
);

/** Reorders OpenAPI URL entries from previousIndex to currentIndex. */
export const reorderOpenApiUrls = createAction(
  '[OpenAPI] Reorder URLs',
  /** props */
  props<{
    /** Original index of the URL entry. */
    previousIndex: number;
    /** New index of the URL entry. */
    currentIndex: number;
  }>(),
);

/** Resets the OpenAPI URL entries to a single empty row. */
export const clearOpenApiUrls = createAction('[OpenAPI] Clear URLs');

/** Triggers fetching for all or specific OpenAPI URL entries. */
export const fetchOpenApiUrls = createAction(
  '[OpenAPI] Fetch URLs',
  /** props */
  props<{
    /** Optional list of entry IDs to fetch. */
    ids?: string[];
  }>(),
);

/** Marks a specific OpenAPI URL entry as currently fetching. */
export const fetchOpenApiUrlStart = createAction(
  '[OpenAPI] Fetch URL Start',
  /** props */
  props<{
    /** ID of the URL entry being fetched. */
    id: string;
  }>(),
);

/** Stores the fetched content and timestamp for a specific OpenAPI URL entry. */
export const fetchOpenApiUrlSuccess = createAction(
  '[OpenAPI] Fetch URL Success',
  /** props */
  props<{
    /** ID of the fetched URL entry. */
    id: string;
    /** Fetched specification content. */
    content: string;
    /** Timestamp when the fetch completed. */
    timestamp: number;
  }>(),
);

/** Records a fetch or validation failure for a specific OpenAPI URL entry. */
export const fetchOpenApiUrlFailure = createAction(
  '[OpenAPI] Fetch URL Failure',
  /** props */
  props<{
    /** ID of the URL entry that failed. */
    id: string;
    /** Error message describing the failure. */
    error: string;
  }>(),
);

/** Applies the merged content from fetched URLs to the main OpenAPI specification state. */
export const applyFetchedUrlsToSpec = createAction(
  '[OpenAPI] Apply Fetched URLs To Spec',
  /** props */
  props<{
    /** Merged OpenAPI specification content. */
    mergedContent: string;
  }>(),
);

// API Docs Actions
/** Toggles the API Docs pane. */
export const toggleApiDocsPane = createAction('[Workspace] Toggle API Docs Pane');
/** Sets the API Docs visibility. */
export const setApiDocsVisibility = createAction(
  '[Workspace] Set API Docs Visibility',
  /** props */
  props<{
    /** Whether the API Docs pane is visible. */
    visible: boolean;
  }>(),
);
/** Resizes the API Docs pane. */
export const resizeApiDocsPane = createAction(
  '[Workspace] Resize Bottom Pane',
  /** props */
  props<{
    /** Height of the API Docs pane in pixels. */
    height: number;
  }>(),
);
/** Fired when API Docs iframe is loaded. */
export const apiDocsIframeLoaded = createAction('[ApiDocs] Iframe Loaded Successfully');
/** Fired when API Docs iframe fails to load. */
export const apiDocsIframeLoadFailed = createAction(
  '[ApiDocs] Iframe Load Failed',
  /** props */
  props<{
    /** Error message from iframe load failure. */
    error: string;
  }>(),
);
