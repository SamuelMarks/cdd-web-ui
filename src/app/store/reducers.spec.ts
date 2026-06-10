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

    it('should carry over shared options when language changes', () => {
      let state = workspaceReducer(
        initialWorkspaceState,
        Actions.setSelectedLanguage({ languageId: 'typescript' }),
      );
      state = workspaceReducer(
        state,
        Actions.setLanguageOptions({
          languageId: 'typescript',
          options: { tests: true, mcp: true, noGithubActions: true },
        }),
      );
      state = workspaceReducer(state, Actions.setSelectedLanguage({ languageId: 'rust' }));
      expect(state.languageOptions['rust']).toEqual({
        tests: true,
        mcp: true,
        noGithubActions: true,
      });
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
        Actions.setLanguageOptions({ languageId: 'typescript', options: { framework: 'vanilla' } }),
      );
      expect(state.languageOptions['typescript']).toEqual({ framework: 'vanilla' });
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
      expect(state.executionError).toBe('err');
    });

    it('should clear executionError on updateOpenApiSpec', () => {
      const stateWithErr = { ...initialWorkspaceState, executionError: 'err' };
      const state = workspaceReducer(stateWithErr, Actions.updateOpenApiSpec({ content: 'new' }));
      expect(state.executionError).toBe(null);
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

    it('should select a file on setGeneratedFiles preferring README', () => {
      const files: GeneratedFile[] = [
        { path: 'main.ts', content: new Uint8Array() },
        { path: 'README.md', content: new Uint8Array() },
      ];
      const state = fileTreeReducer(initialFileTreeState, Actions.setGeneratedFiles({ files }));
      expect(state.files).toEqual(files);
      expect(state.activeFilePath).toBe('README.md');
    });

    it('should select first file on setGeneratedFiles if no matching pattern', () => {
      const files: GeneratedFile[] = [
        { path: 'file1.txt', content: new Uint8Array() },
        { path: 'file2.txt', content: new Uint8Array() },
      ];
      const state = fileTreeReducer(initialFileTreeState, Actions.setGeneratedFiles({ files }));
      expect(state.files).toEqual(files);
      expect(state.activeFilePath).toBe('file1.txt');
    });

    it('should clear active file path if no files are generated', () => {
      const state = fileTreeReducer(
        { ...initialFileTreeState, activeFilePath: 'old.ts' },
        Actions.setGeneratedFiles({ files: [] }),
      );
      expect(state.files).toEqual([]);
      expect(state.activeFilePath).toBeNull();
    });

    it('should select a file containing a model definition based on parsed modelNames', () => {
      const files: GeneratedFile[] = [
        { path: 'main.ts', content: new Uint8Array() },
        { path: 'models.ts', content: new TextEncoder().encode('export class Pet {') },
      ];
      const state = fileTreeReducer(
        initialFileTreeState,
        Actions.setGeneratedFiles({ files, modelNames: ['Pet', 'User'] }),
      );
      expect(state.activeFilePath).toBe('models.ts');
    });

    it('should select a file based on generic model fallback patterns', () => {
      const files: GeneratedFile[] = [
        { path: 'main.ts', content: new Uint8Array() },
        { path: 'fallback.go', content: new TextEncoder().encode('type User struct {') },
      ];
      const state = fileTreeReducer(initialFileTreeState, Actions.setGeneratedFiles({ files }));
      expect(state.activeFilePath).toBe('fallback.go');
    });

    it('should fallback to all files if candidate files are empty in setGeneratedFiles', () => {
      const files: GeneratedFile[] = [
        { path: 'package.json', content: new Uint8Array() }, // package.json is ignored
      ];
      const state = fileTreeReducer(initialFileTreeState, Actions.setGeneratedFiles({ files }));
      // It falls back to all files and activeFilePath might become package.json
      expect(state.files).toEqual(files);
      expect(state.activeFilePath).toBe('package.json');
    });

    it('should fall back if modelNames are provided but no file matches', () => {
      const files: GeneratedFile[] = [
        { path: 'main.ts', content: new Uint8Array() },
        { path: 'empty.ts', content: new TextEncoder().encode('const x = 1;') },
      ];
      const state = fileTreeReducer(
        initialFileTreeState,
        Actions.setGeneratedFiles({ files, modelNames: ['NonExistentModel'] }),
      );
      // It falls back to filename patterns, then to the first file (main.ts)
      expect(state.activeFilePath).toBe('main.ts');
    });

    it('should select a file', () => {
      const state = fileTreeReducer(
        initialFileTreeState,
        Actions.selectFile({ filePath: 'new.ts' }),
      );
      expect(state.activeFilePath).toBe('new.ts');
    });

    it('should clear files and active file path on setSelectedLanguage', () => {
      let state = fileTreeReducer(
        initialFileTreeState,
        Actions.setGeneratedFiles({
          files: [{ path: 'test.ts', content: new Uint8Array() }],
        }),
      );
      state = fileTreeReducer(state, Actions.setSelectedLanguage({ languageId: 'python' }));
      expect(state.files).toEqual([]);
      expect(state.activeFilePath).toBeNull();
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

describe('updateActiveFileContent action', () => {
  it('should return state unchanged if activeFilePath is null', () => {
    const state = { ...initialFileTreeState, activeFilePath: null };
    const action = Actions.updateActiveFileContent({ content: 'test' });
    const result = fileTreeReducer(state, action);
    expect(result).toBe(state);
  });

  it('should update the file content if activeFilePath is set', () => {
    const file = { path: 'test.ts', content: new TextEncoder().encode('old') };
    const state = {
      ...initialFileTreeState,
      activeFilePath: 'test.ts',
      files: [
        file as unknown as GeneratedFile,
        {
          path: 'other.ts',
          content: new TextEncoder().encode('other'),
        } as unknown as GeneratedFile,
      ],
    };
    const action = Actions.updateActiveFileContent({ content: 'new content' });
    const result = fileTreeReducer(state, action);
    expect(result.files[0].content).toEqual(new TextEncoder().encode('new content'));
  });
});
