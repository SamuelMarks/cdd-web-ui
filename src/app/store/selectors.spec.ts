import * as Selectors from './selectors';
import { AppState } from './state';
import { GeneratedFile } from '../services/wasm-worker.service';
import { describe, it, expect } from 'vitest';

describe('Selectors', () => {
  const mockState: AppState = {
    workspace: {
      orientation: 'openapi-right',
      isExecuting: true,
      selectedLanguageId: 'rust',
    },
    fileTree: {
      files: [
        { path: 'test.rs', content: new Uint8Array([116, 101, 115, 116]) }, // "test"
      ],
      activeFilePath: 'test.rs',
    },
    openApi: {
      specContent: 'openapi: 3.0.0',
      validationErrors: ['error1'],
    },
  };

  it('should select orientation', () => {
    expect(Selectors.selectOrientation(mockState)).toBe('openapi-right');
  });

  it('should select isExecuting', () => {
    expect(Selectors.selectIsExecuting(mockState)).toBe(true);
  });

  it('should select selectedLanguageId', () => {
    expect(Selectors.selectSelectedLanguageId(mockState)).toBe('rust');
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
    const state = { ...mockState, fileTree: { ...mockState.fileTree, activeFilePath: 'notfound.rs' } };
    expect(Selectors.selectActiveFileContent(state)).toBeNull();
  });

  it('should select open api spec content', () => {
    expect(Selectors.selectOpenApiSpecContent(mockState)).toBe('openapi: 3.0.0');
  });

  it('should select open api validation errors', () => {
    expect(Selectors.selectOpenApiValidationErrors(mockState)).toEqual(['error1']);
  });
});
