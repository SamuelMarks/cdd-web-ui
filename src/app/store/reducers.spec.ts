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

    it('should set online mode', () => {
      const state = workspaceReducer(
        initialWorkspaceState,
        Actions.setOnlineMode({ isOnlineMode: true }),
      );
      expect(state.isOnlineMode).toBe(true);
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

    it('should store docsJsonFiles on loadDocsJsonSuccess, executeRunSuccess with docs.json, clear on setSelectedLanguage or executeRunSuccess without docs.json, and ignore stale languageId', () => {
      const docsFile: GeneratedFile = {
        path: 'docs.json',
        content: new TextEncoder().encode('{"endpoints":{}}'),
      };
      let state = workspaceReducer(
        initialWorkspaceState,
        Actions.loadDocsJsonSuccess({ files: [docsFile] }),
      );
      expect(state.docsJsonFiles).toEqual([docsFile]);
      expect(state.docsJsonLanguageId).toBe('c');

      state = workspaceReducer(
        state,
        Actions.loadDocsJsonSuccess({ files: [docsFile], languageId: 'c' }),
      );
      expect(state.docsJsonFiles).toEqual([docsFile]);
      expect(state.docsJsonLanguageId).toBe('c');

      // Ignore loadDocsJsonSuccess from a stale language
      const staleDocsFile: GeneratedFile = {
        path: 'docs.json',
        content: new TextEncoder().encode('{"endpoints":{"/stale":{}}}'),
      };
      state = workspaceReducer(
        state,
        Actions.loadDocsJsonSuccess({ files: [staleDocsFile], languageId: 'rust' }),
      );
      expect(state.docsJsonFiles).toEqual([docsFile]);

      state = workspaceReducer(state, Actions.loadDocsJsonFailure({ error: 'failed' }));
      expect(state.docsJsonFiles).toEqual([docsFile]);

      // Switching language clears docsJsonFiles and docsJsonLanguageId
      state = workspaceReducer(state, Actions.setSelectedLanguage({ languageId: 'cpp' }));
      expect(state.selectedLanguageId).toBe('cpp');
      expect(state.docsJsonFiles).toBeUndefined();
      expect(state.docsJsonLanguageId).toBeUndefined();

      const nestedDocsFile: GeneratedFile = {
        path: 'out/docs.json',
        content: new TextEncoder().encode('{"endpoints":{"/pet":{}}}'),
      };
      state = workspaceReducer(state, Actions.executeRunSuccess({ result: [nestedDocsFile] }));
      expect(state.docsJsonFiles).toEqual([nestedDocsFile]);
      expect(state.docsJsonLanguageId).toBe('cpp');

      // Ignore executeRunSuccess from a stale language
      state = workspaceReducer(
        state,
        Actions.executeRunSuccess({ result: [docsFile], languageId: 'c' }),
      );
      expect(state.docsJsonFiles).toEqual([nestedDocsFile]);

      // Clear docsJsonFiles when executeRunSuccess returns files without docs.json
      state = workspaceReducer(
        state,
        Actions.executeRunSuccess({
          result: [{ path: 'src/client.cpp', content: new Uint8Array() }],
        }),
      );
      expect(state.docsJsonFiles).toBeUndefined();
      expect(state.docsJsonLanguageId).toBeUndefined();

      const stateFromString = workspaceReducer(
        initialWorkspaceState,
        Actions.executeRunSuccess({ result: 'openapi: 3.2.0' }),
      );
      expect(stateFromString.isExecuting).toBe(false);
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

    it('should set open api input mode', () => {
      const state = openApiReducer(
        initialOpenApiState,
        Actions.setOpenApiInputMode({ mode: 'urls' }),
      );
      expect(state.activeInputMode).toBe('urls');
    });

    it('should add open api url with explicit id, default url, or auto-generated id', () => {
      let state = openApiReducer(
        initialOpenApiState,
        Actions.addOpenApiUrl({ url: 'https://example.com/1.yaml', id: 'url-1' }),
      );
      expect(state.specUrls[state.specUrls.length - 1]).toEqual({
        id: 'url-1',
        url: 'https://example.com/1.yaml',
        status: 'idle',
        error: null,
      });

      state = openApiReducer(state, Actions.addOpenApiUrl({}));
      expect(state.specUrls[state.specUrls.length - 1].url).toBe('');
      expect(state.specUrls[state.specUrls.length - 1].id).toMatch(/^url-\d+$/);
    });

    it('should update open api url and reset status/error', () => {
      let state = openApiReducer(
        initialOpenApiState,
        Actions.addOpenApiUrl({ url: 'https://old.com', id: 'url-test' }),
      );
      state = openApiReducer(
        state,
        Actions.fetchOpenApiUrlFailure({ id: 'url-test', error: 'bad' }),
      );
      state = openApiReducer(
        state,
        Actions.updateOpenApiUrl({ id: 'url-test', url: 'https://new.com' }),
      );
      const updated = state.specUrls.find((u) => u.id === 'url-test');
      expect(updated?.url).toBe('https://new.com');
      expect(updated?.status).toBe('idle');
      expect(updated?.error).toBeNull();
    });

    it('should remove open api url', () => {
      let state = openApiReducer(
        initialOpenApiState,
        Actions.addOpenApiUrl({ url: 'https://remove.me', id: 'url-rem' }),
      );
      state = openApiReducer(state, Actions.removeOpenApiUrl({ id: 'url-rem' }));
      expect(state.specUrls.find((u) => u.id === 'url-rem')).toBeUndefined();
    });

    it('should reorder open api urls and ignore out-of-bounds indices', () => {
      let state = openApiReducer(initialOpenApiState, Actions.clearOpenApiUrls());
      state = openApiReducer(state, Actions.addOpenApiUrl({ url: 'https://a.com', id: 'a' }));
      state = openApiReducer(state, Actions.addOpenApiUrl({ url: 'https://b.com', id: 'b' }));

      const reordered = openApiReducer(
        state,
        Actions.reorderOpenApiUrls({ previousIndex: 0, currentIndex: 1 }),
      );
      expect(reordered.specUrls.map((u) => u.id)).toEqual(['b', 'a']);

      const unchangedSame = openApiReducer(
        reordered,
        Actions.reorderOpenApiUrls({ previousIndex: 0, currentIndex: 0 }),
      );
      expect(unchangedSame).toBe(reordered);

      const unchangedNegative = openApiReducer(
        reordered,
        Actions.reorderOpenApiUrls({ previousIndex: -1, currentIndex: 0 }),
      );
      expect(unchangedNegative).toBe(reordered);

      const unchangedOverflow = openApiReducer(
        reordered,
        Actions.reorderOpenApiUrls({ previousIndex: 0, currentIndex: 99 }),
      );
      expect(unchangedOverflow).toBe(reordered);
    });

    it('should clear open api urls', () => {
      const state = openApiReducer(initialOpenApiState, Actions.clearOpenApiUrls());
      expect(state.specUrls).toEqual([]);
      expect(state.isFetchingUrls).toBe(false);
    });

    it('should handle fetchOpenApiUrlStart, Success, Failure, and applyFetchedUrlsToSpec', () => {
      let state = openApiReducer(initialOpenApiState, Actions.clearOpenApiUrls());
      state = openApiReducer(state, Actions.addOpenApiUrl({ url: 'https://1.com', id: 'u1' }));
      state = openApiReducer(state, Actions.addOpenApiUrl({ url: 'https://2.com', id: 'u2' }));

      state = openApiReducer(state, Actions.fetchOpenApiUrlStart({ id: 'u1' }));
      expect(state.isFetchingUrls).toBe(true);
      expect(state.specUrls.find((u) => u.id === 'u1')?.status).toBe('loading');

      state = openApiReducer(
        state,
        Actions.fetchOpenApiUrlSuccess({ id: 'u1', content: 'spec1', timestamp: 12345 }),
      );
      expect(state.isFetchingUrls).toBe(false);
      expect(state.specUrls.find((u) => u.id === 'u1')?.status).toBe('loaded');
      expect(state.specUrls.find((u) => u.id === 'u1')?.content).toBe('spec1');
      expect(state.specUrls.find((u) => u.id === 'u1')?.lastFetched).toBe(12345);

      state = openApiReducer(state, Actions.fetchOpenApiUrlStart({ id: 'u2' }));
      expect(state.isFetchingUrls).toBe(true);

      state = openApiReducer(state, Actions.fetchOpenApiUrlFailure({ id: 'u2', error: '404' }));
      expect(state.isFetchingUrls).toBe(false);
      expect(state.specUrls.find((u) => u.id === 'u2')?.status).toBe('error');
      expect(state.specUrls.find((u) => u.id === 'u2')?.error).toBe('404');

      state = openApiReducer(state, Actions.applyFetchedUrlsToSpec({ mergedContent: 'merged' }));
      expect(state.specContent).toBe('merged');
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
