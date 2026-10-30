import * as Selectors from './selectors';
import { AppState } from './state';
import { describe, it, expect } from 'vitest';

describe('Selectors', () => {
  const mockState: AppState = {
    workspace: {
      orientation: 'openapi-right',
      isExecuting: true,
      executionError: null,
      selectedLanguageId: 'rust',
      target: 'to_sdk',
      languageOptions: {},
      isApiDocsVisible: false,
      apiDocsPaneHeight: 300,
      apiDocsLoadState: 'IDLE',
      isOnlineMode: true,
    },
    fileTree: {
      files: [
        { path: 'test.rs', content: new Uint8Array([116, 101, 115, 116]) }, // "test"
      ],
      activeFilePath: 'test.rs',
    },
    openApi: {
      specContent: 'openapi: 3.0.0',
      inputFormat: 'openapi_older',
      validationErrors: ['error1'],
      activeInputMode: 'urls',
      specUrls: [
        { id: 'u1', url: 'https://example.com/spec.yaml', status: 'loaded', error: null },
        { id: 'u2', url: '   ', status: 'idle', error: 'Bad URL' },
      ],
      isFetchingUrls: true,
    },
  };

  it('should select orientation', () => {
    expect(Selectors.selectOrientation(mockState)).toBe('openapi-right');
  });

  it('should select isExecuting', () => {
    expect(Selectors.selectIsExecuting(mockState)).toBe(true);
  });

  it('should select executionError', () => {
    const state = { ...mockState, workspace: { ...mockState.workspace, executionError: 'err' } };
    expect(Selectors.selectExecutionError(state)).toBe('err');
  });

  it('should select selectedLanguageId', () => {
    expect(Selectors.selectSelectedLanguageId(mockState)).toBe('rust');
  });

  it('should select isOnlineMode', () => {
    expect(Selectors.selectIsOnlineMode(mockState)).toBe(true);
  });

  it('should select generated files', () => {
    expect(Selectors.selectGeneratedFiles(mockState)).toEqual(mockState.fileTree.files);
  });

  it('should select active file path', () => {
    expect(Selectors.selectActiveFilePath(mockState)).toBe('test.rs');
  });

  it('should select active file content decoded as text', () => {
    expect(Selectors.selectActiveFileContent(mockState)).toBe('test');
  });

  it('should return null for active file content if no active path', () => {
    const state = { ...mockState, fileTree: { ...mockState.fileTree, activeFilePath: null } };
    expect(Selectors.selectActiveFileContent(state)).toBeNull();
  });

  it('should return null for active file content if file not found', () => {
    const state = {
      ...mockState,
      fileTree: { ...mockState.fileTree, activeFilePath: 'notfound.rs' },
    };
    expect(Selectors.selectActiveFileContent(state)).toBeNull();
  });

  it('should select open api spec content', () => {
    expect(Selectors.selectOpenApiSpecContent(mockState)).toBe('openapi: 3.0.0');
  });

  it('should select open api validation errors', () => {
    expect(Selectors.selectOpenApiValidationErrors(mockState)).toEqual(['error1']);
  });

  it('should select open api input format', () => {
    expect(Selectors.selectOpenApiInputFormat(mockState)).toBe('openapi_older');
  });

  it('should select open api input mode', () => {
    expect(Selectors.selectOpenApiInputMode(mockState)).toBe('urls');
  });

  it('should select open api spec urls', () => {
    expect(Selectors.selectOpenApiSpecUrls(mockState)).toEqual(mockState.openApi.specUrls);
  });

  it('should select isFetchingOpenApiUrls', () => {
    expect(Selectors.selectIsFetchingOpenApiUrls(mockState)).toBe(true);
  });

  it('should select valid open api url count', () => {
    expect(Selectors.selectValidOpenApiUrlCount(mockState)).toBe(1);
  });

  it('should select open api url errors', () => {
    expect(Selectors.selectOpenApiUrlErrors(mockState)).toEqual(['Bad URL']);
  });

  describe('API Docs Selectors', () => {
    it('should select isApiDocsVisible', () => {
      const result = Selectors.selectIsApiDocsVisible(mockState);
      expect(result).toBe(false);
    });

    it('should select apiDocsPaneHeight', () => {
      const result = Selectors.selectApiDocsPaneHeight(mockState);
      expect(result).toBe(300);
    });

    it('should select apiDocsLoadState', () => {
      const result = Selectors.selectApiDocsLoadState(mockState);
      expect(result).toBe('IDLE');
    });

    it('should select docsJsonFiles and docsJsonExamples', () => {
      expect(Selectors.selectDocsJsonFiles(mockState)).toEqual([]);
      expect(Selectors.selectDocsJsonFiles({} as AppState)).toEqual([]);
      expect(Selectors.selectDocsJsonExamples(mockState)).toEqual([]);

      const docsFile = {
        path: 'docs.json',
        content: new TextEncoder().encode('{"endpoints":{}}'),
      };
      const stateWithFileTreeDocs: AppState = {
        ...mockState,
        fileTree: {
          ...mockState.fileTree,
          files: [docsFile, { path: 'sub/docs.json', content: new Uint8Array() }],
        },
      };
      expect(Selectors.selectDocsJsonExamples(stateWithFileTreeDocs)).toHaveLength(2);

      const dedicatedDocs = [{ path: 'docs.json', content: new Uint8Array([1]) }];
      const stateWithDedicatedDocs: AppState = {
        ...stateWithFileTreeDocs,
        workspace: {
          ...mockState.workspace,
          docsJsonFiles: dedicatedDocs,
          docsJsonLanguageId: 'rust',
        },
      };
      expect(Selectors.selectDocsJsonLanguageId(stateWithDedicatedDocs)).toBe('rust');
      expect(Selectors.selectDocsJsonLanguageId({} as AppState)).toBeUndefined();
      expect(Selectors.selectDocsJsonExamples(stateWithDedicatedDocs)).toEqual(dedicatedDocs);

      const stateWithStaleDedicatedDocs: AppState = {
        ...stateWithFileTreeDocs,
        workspace: {
          ...mockState.workspace,
          selectedLanguageId: 'cpp',
          docsJsonFiles: dedicatedDocs,
          docsJsonLanguageId: 'c',
        },
      };
      expect(Selectors.selectDocsJsonFiles(stateWithStaleDedicatedDocs)).toEqual([]);
    });
  });
});
