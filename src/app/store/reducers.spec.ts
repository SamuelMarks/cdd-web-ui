import {
  workspaceReducer,
  fileTreeReducer,
  openApiReducer,
  initialWorkspaceState,
  initialFileTreeState,
  initialOpenApiState,
} from './reducers';
import * as Actions from './actions';
import { GeneratedFile } from '../services/wasm-worker.service';
import { describe, it, expect } from 'vitest';

describe('Reducers', () => {
  describe('WorkspaceReducer', () => {
    it('should toggle orientation', () => {
      let state = workspaceReducer(initialWorkspaceState, Actions.toggleOrientation());
      expect(state.orientation).toBe('openapi-right');
      state = workspaceReducer(state, Actions.toggleOrientation());
      expect(state.orientation).toBe('openapi-left');
    });

    it('should set orientation explicitly', () => {
      const state = workspaceReducer(
        initialWorkspaceState,
        Actions.setOrientation({ orientation: 'openapi-right' }),
      );
      expect(state.orientation).toBe('openapi-right');
    });

    it('should set selected language', () => {
      const state = workspaceReducer(
        initialWorkspaceState,
        Actions.setSelectedLanguage({ languageId: 'python' }),
      );
      expect(state.selectedLanguageId).toBe('python');
    });

    it('should set target', () => {
      const state = workspaceReducer(
        initialWorkspaceState,
        Actions.setTarget({ target: 'to_server' }),
      );
      expect(state.target).toBe('to_server');
    });

    it('should set language options', () => {
      const state = workspaceReducer(
        initialWorkspaceState,
        Actions.setLanguageOptions({ languageId: 'typescript', options: { framework: 'fetch' } }),
      );
      expect(state.languageOptions['typescript']).toEqual({ framework: 'fetch' });
    });

    it('should handle executeRunStart', () => {
      const state = workspaceReducer(initialWorkspaceState, Actions.executeRunStart());
      expect(state.isExecuting).toBe(true);
    });

    it('should handle executeRunSuccess and Failure', () => {
      let state = workspaceReducer(initialWorkspaceState, Actions.executeRunStart());
      state = workspaceReducer(state, Actions.executeRunSuccess({ result: [] }));
      expect(state.isExecuting).toBe(false);

      state = workspaceReducer(initialWorkspaceState, Actions.executeRunStart());
      state = workspaceReducer(state, Actions.executeRunFailure({ error: 'err' }));
      expect(state.isExecuting).toBe(false);
    });

    it('should toggle api docs pane', () => {
      let state = workspaceReducer(initialWorkspaceState, Actions.toggleApiDocsPane());
      expect(state.isApiDocsVisible).toBe(true);
      state = workspaceReducer(state, Actions.toggleApiDocsPane());
      expect(state.isApiDocsVisible).toBe(false);
    });

    it('should set api docs visibility', () => {
      let state = workspaceReducer(
        initialWorkspaceState,
        Actions.setApiDocsVisibility({ visible: true }),
      );
      expect(state.isApiDocsVisible).toBe(true);
      expect(state.apiDocsLoadState).toBe('LOADING');

      state = workspaceReducer(state, Actions.setApiDocsVisibility({ visible: false }));
      expect(state.isApiDocsVisible).toBe(false);
      // load state remains unchanged when hiding
      expect(state.apiDocsLoadState).toBe('LOADING');
    });

    it('should resize api docs pane', () => {
      const state = workspaceReducer(
        initialWorkspaceState,
        Actions.resizeApiDocsPane({ height: 500 }),
      );
      expect(state.apiDocsPaneHeight).toBe(500);
    });

    it('should handle iframe load success and failure', () => {
      let state = workspaceReducer(initialWorkspaceState, Actions.apiDocsIframeLoaded());
      expect(state.apiDocsLoadState).toBe('LOADED');

      state = workspaceReducer(state, Actions.apiDocsIframeLoadFailed({ error: 'failed' }));
      expect(state.apiDocsLoadState).toBe('ERROR');
    });
  });

  describe('FileTreeReducer', () => {
    it('should set generated files and active file path', () => {
      const files: GeneratedFile[] = [
        { path: 'test1.ts', content: new Uint8Array() },
        { path: 'test2.ts', content: new Uint8Array() },
      ];
      const state = fileTreeReducer(initialFileTreeState, Actions.setGeneratedFiles({ files }));
      expect(state.files).toEqual(files);
      expect(state.activeFilePath).toBe('test1.ts');
    });

    it('should clear active file path if no files are generated', () => {
      const state = fileTreeReducer(
        { ...initialFileTreeState, activeFilePath: 'old.ts' },
        Actions.setGeneratedFiles({ files: [] }),
      );
      expect(state.files).toEqual([]);
      expect(state.activeFilePath).toBeNull();
    });

    it('should select a file', () => {
      const state = fileTreeReducer(
        initialFileTreeState,
        Actions.selectFile({ filePath: 'new.ts' }),
      );
      expect(state.activeFilePath).toBe('new.ts');
    });
  });

  describe('OpenApiReducer', () => {
    it('should update open api spec content', () => {
      const state = openApiReducer(
        initialOpenApiState,
        Actions.updateOpenApiSpec({ content: 'new content' }),
      );
      expect(state.specContent).toBe('new content');
    });

    it('should set open api validation errors', () => {
      const state = openApiReducer(
        initialOpenApiState,
        Actions.setOpenApiValidationErrors({ errors: ['error1', 'error2'] }),
      );
      expect(state.validationErrors).toEqual(['error1', 'error2']);
    });

    it('should set open api input format', () => {
      const state = openApiReducer(
        initialOpenApiState,
        Actions.setInputFormat({ format: 'google_discovery' }),
      );
      expect(state.inputFormat).toBe('google_discovery');
    });
  });
});
