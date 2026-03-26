import { TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable, of, throwError } from 'rxjs';
import { ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { WorkspaceEffects } from './effects';
import * as Actions from './actions';
import { WasmWorkerService, GeneratedFile } from '../services/wasm-worker.service';
import { LanguageService } from '../services/language.service';
import { NotificationService } from '../services/notification.service';
import { AppState } from './state';
import { initialWorkspaceState, initialFileTreeState, initialOpenApiState } from './reducers';
import {
  selectOrientation,
  selectSelectedLanguageId,
  selectOpenApiSpecContent,
  selectOpenApiInputFormat,
  selectIsApiDocsVisible,
  selectApiDocsPaneHeight,
  selectActiveFileContent,
} from './selectors';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('WorkspaceEffects', () => {
  let actions$: Observable<Action>;
  let effects: WorkspaceEffects;
  let store: MockStore<AppState>;
  let wasmWorkerServiceMock: Record<string, import('vitest').Mock>;
  let languageServiceMock: Record<string, import('vitest').Mock>;
  let notificationServiceMock: { error: import('vitest').Mock; success: import('vitest').Mock };

  beforeEach(() => {
    wasmWorkerServiceMock = {
      generateCode: vi.fn(),
    };
    languageServiceMock = {
      languages: vi.fn().mockReturnValue([
        { id: 'python', name: 'Python', repo: 'cdd-python', availableInWasm: true },
        { id: 'java', name: 'Java', repo: 'cdd-java', availableInWasm: false },
        { id: 'openapi', name: 'OpenAPI', repo: 'cdd-cpp', availableInWasm: true },
      ]),
    };
    notificationServiceMock = {
      success: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        WorkspaceEffects,
        provideMockActions(() => actions$),
        provideMockStore({
          initialState: {
            workspace: initialWorkspaceState,
            fileTree: initialFileTreeState,
            openApi: initialOpenApiState,
          },
        }),
        { provide: WasmWorkerService, useValue: wasmWorkerServiceMock },
        { provide: LanguageService, useValue: languageServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock },
      ],
    });

    effects = TestBed.inject(WorkspaceEffects);
    store = TestBed.inject(MockStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeRun$', () => {
    it('should return executeRunFailure if language is not found', async () => {
      store.overrideSelector(selectOrientation, 'openapi-left');
      store.overrideSelector(selectSelectedLanguageId, 'unknown');
      store.overrideSelector(selectOpenApiSpecContent, '{}');

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(result).toEqual(
        Actions.executeRunFailure({ error: "Selected language ID 'unknown' not found." }),
      );
    });

    it('should return executeRunFailure if language does not support WASM', async () => {
      store.overrideSelector(selectOrientation, 'openapi-left');
      store.overrideSelector(selectSelectedLanguageId, 'java');
      store.overrideSelector(selectOpenApiSpecContent, '{}');

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(result).toEqual(
        Actions.executeRunFailure({
          error: "Language 'Java' does not support offline WASM generation.",
        }),
      );
    });

    it('should call generateCode and return executeRunSuccess on openapi-left orientation', async () => {
      store.overrideSelector(selectOrientation, 'openapi-left');
      store.overrideSelector(selectSelectedLanguageId, 'python');
      store.overrideSelector(selectOpenApiSpecContent, '{}');
      store.overrideSelector(selectOpenApiInputFormat, 'openapi_3_2_0');

      const mockFiles: GeneratedFile[] = [{ path: 'test.py', content: new Uint8Array() }];
      wasmWorkerServiceMock.generateCode.mockResolvedValue(mockFiles);

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(wasmWorkerServiceMock.generateCode).toHaveBeenCalledWith(
        'cdd-python',
        '{}',
        'to_sdk',
        {},
      );
      expect(result).toEqual(Actions.executeRunSuccess({ result: mockFiles }));
    });

    it('should upgrade spec if format is not openapi_3_2_0 and language is not cdd-cpp', async () => {
      store.overrideSelector(selectOrientation, 'openapi-left');
      store.overrideSelector(selectSelectedLanguageId, 'python');
      store.overrideSelector(selectOpenApiSpecContent, 'old_spec');
      store.overrideSelector(selectOpenApiInputFormat, 'google_discovery');

      const upgradedSpecContent = 'upgraded_spec';
      const upgradedFiles: GeneratedFile[] = [
        { path: 'api.yaml', content: new TextEncoder().encode(upgradedSpecContent) },
      ];
      const finalFiles: GeneratedFile[] = [{ path: 'test.py', content: new Uint8Array() }];

      // Mock first call to cdd-cpp for upgrade
      wasmWorkerServiceMock.generateCode.mockResolvedValueOnce(upgradedFiles);
      // Mock second call to actual target
      wasmWorkerServiceMock.generateCode.mockResolvedValueOnce(finalFiles);

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(wasmWorkerServiceMock.generateCode).toHaveBeenNthCalledWith(
        1,
        'cdd-cpp',
        'old_spec',
        'to_openapi_3_2_0',
        { inputFormat: 'google_discovery' },
      );
      expect(wasmWorkerServiceMock.generateCode).toHaveBeenNthCalledWith(
        2,
        'cdd-python',
        upgradedSpecContent,
        'to_sdk',
        {},
      );
      expect(result).toEqual(Actions.executeRunSuccess({ result: finalFiles }));
    });

    it('should fallback to original spec if upgrade returns no spec file', async () => {
      store.overrideSelector(selectOrientation, 'openapi-left');
      store.overrideSelector(selectSelectedLanguageId, 'python');
      store.overrideSelector(selectOpenApiSpecContent, 'old_spec');
      store.overrideSelector(selectOpenApiInputFormat, 'google_discovery');

      const upgradedFiles: GeneratedFile[] = [
        { path: 'other.txt', content: new TextEncoder().encode('other') },
      ];
      const finalFiles: GeneratedFile[] = [{ path: 'test.py', content: new Uint8Array() }];

      wasmWorkerServiceMock.generateCode.mockResolvedValueOnce(upgradedFiles);
      wasmWorkerServiceMock.generateCode.mockResolvedValueOnce(finalFiles);

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(wasmWorkerServiceMock.generateCode).toHaveBeenNthCalledWith(
        2,
        'cdd-python',
        'old_spec',
        'to_sdk',
        {},
      );
      expect(result).toEqual(Actions.executeRunSuccess({ result: finalFiles }));
    });

    it('should override target if language is openapi', async () => {
      store.overrideSelector(selectOrientation, 'openapi-left');
      store.overrideSelector(selectSelectedLanguageId, 'openapi');
      store.overrideSelector(selectOpenApiSpecContent, '{}');
      store.overrideSelector(selectOpenApiInputFormat, 'openapi_3_2_0');

      const mockFiles: GeneratedFile[] = [{ path: 'test.yaml', content: new Uint8Array() }];
      wasmWorkerServiceMock.generateCode.mockResolvedValue(mockFiles);

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(wasmWorkerServiceMock.generateCode).toHaveBeenCalledWith(
        'cdd-cpp',
        '{}',
        'to_openapi_3_2_0',
        {},
      );
      expect(result).toEqual(Actions.executeRunSuccess({ result: mockFiles }));
    });

    it('should call generateCode and return executeRunFailure on error', async () => {
      store.overrideSelector(selectOrientation, 'openapi-left');
      store.overrideSelector(selectSelectedLanguageId, 'python');
      store.overrideSelector(selectOpenApiSpecContent, '{}');
      store.overrideSelector(selectOpenApiInputFormat, 'openapi_3_2_0');

      wasmWorkerServiceMock.generateCode.mockRejectedValue(new Error('WASM error'));

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(result).toEqual(Actions.executeRunFailure({ error: 'WASM error' }));
    });

    it('should call generateCode and return executeRunFailure on error string payload', async () => {
      store.overrideSelector(selectOrientation, 'openapi-left');
      store.overrideSelector(selectSelectedLanguageId, 'python');
      store.overrideSelector(selectOpenApiSpecContent, '{}');
      store.overrideSelector(selectOpenApiInputFormat, 'openapi_3_2_0');

      wasmWorkerServiceMock.generateCode.mockRejectedValue('Unknown string error');

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(result).toEqual(Actions.executeRunFailure({ error: 'Unknown string error' }));
    });

    it('should call generateCode with to_openapi and return executeRunSuccess on openapi-right orientation', async () => {
      store.overrideSelector(selectOrientation, 'openapi-right');
      store.overrideSelector(selectSelectedLanguageId, 'python');
      store.overrideSelector(selectOpenApiSpecContent, '{}');
      store.overrideSelector(selectOpenApiInputFormat, 'openapi_3_2_0');
      store.overrideSelector(selectActiveFileContent, 'console.log("hello")');

      const mockSpecContent = 'openapi: 3.0.0';
      const mockFiles: GeneratedFile[] = [{ path: 'openapi.yaml', content: new TextEncoder().encode(mockSpecContent) }];
      wasmWorkerServiceMock.generateCode.mockResolvedValue(mockFiles);

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(wasmWorkerServiceMock.generateCode).toHaveBeenCalledWith(
        'cdd-python',
        'console.log("hello")',
        'to_openapi',
        {}
      );
      expect(result).toEqual(Actions.executeRunSuccess({ result: mockSpecContent }));
    });

    it('should return executeRunFailure if no OpenAPI specification is generated in openapi-right orientation', async () => {
      store.overrideSelector(selectOrientation, 'openapi-right');
      store.overrideSelector(selectSelectedLanguageId, 'python');
      store.overrideSelector(selectOpenApiSpecContent, '{}');
      store.overrideSelector(selectOpenApiInputFormat, 'openapi_3_2_0');
      store.overrideSelector(selectActiveFileContent, 'console.log("hello")');

      // Return files that do not contain 'openapi' in their path/name
      const mockFiles: GeneratedFile[] = [{ path: 'other.txt', content: new Uint8Array() }];
      wasmWorkerServiceMock.generateCode.mockResolvedValue(mockFiles);

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(result).toEqual(Actions.executeRunFailure({ error: 'No OpenAPI specification generated.' }));
    });

    it('should catch errors and return executeRunFailure in openapi-right orientation', async () => {
      store.overrideSelector(selectOrientation, 'openapi-right');
      store.overrideSelector(selectSelectedLanguageId, 'python');
      store.overrideSelector(selectOpenApiSpecContent, '{}');
      store.overrideSelector(selectOpenApiInputFormat, 'openapi_3_2_0');
      store.overrideSelector(selectActiveFileContent, 'console.log("hello")');

      wasmWorkerServiceMock.generateCode.mockRejectedValue(new Error('Generation failed'));

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(result).toEqual(Actions.executeRunFailure({ error: 'Generation failed' }));
    });

    it('should catch string errors and use fallback activeFileContent in openapi-right orientation', async () => {
      store.overrideSelector(selectOrientation, 'openapi-right');
      store.overrideSelector(selectSelectedLanguageId, 'python');
      store.overrideSelector(selectOpenApiSpecContent, '{}');
      store.overrideSelector(selectOpenApiInputFormat, 'openapi_3_2_0');
      store.overrideSelector(selectActiveFileContent, null);

      wasmWorkerServiceMock.generateCode.mockRejectedValue('String error');

      actions$ = of(Actions.executeRun());

      const result = await effects.executeRun$.toPromise();
      expect(wasmWorkerServiceMock.generateCode).toHaveBeenCalledWith('cdd-python', '', 'to_openapi', {});
      expect(result).toEqual(Actions.executeRunFailure({ error: 'String error' }));
    });
  });

  describe('handleExecutionSuccess$', () => {
    it('should dispatch setGeneratedFiles and show success toast if result is an array', () => {
      const mockFiles: GeneratedFile[] = [{ path: 'test.py', content: new Uint8Array() }];
      actions$ = of(Actions.executeRunSuccess({ result: mockFiles }));
      const spy = vi.spyOn(store, 'dispatch');

      effects.handleExecutionSuccess$.subscribe();

      expect(spy).toHaveBeenCalledWith(Actions.setGeneratedFiles({ files: mockFiles }));
      expect(notificationServiceMock.success).toHaveBeenCalledWith(
        'Successfully generated 1 file(s).',
      );
    });

    it('should dispatch updateOpenApiSpec and show success toast if result is a string', () => {
      actions$ = of(Actions.executeRunSuccess({ result: 'openapi: 3.0.0' }));
      const spy = vi.spyOn(store, 'dispatch');

      effects.handleExecutionSuccess$.subscribe();

      expect(spy).toHaveBeenCalledWith(Actions.updateOpenApiSpec({ content: 'openapi: 3.0.0' }));
      expect(notificationServiceMock.success).toHaveBeenCalledWith(
        'Successfully generated OpenAPI specification.',
      );
    });

    it('should ignore success payload if neither array nor string', () => {
      // @ts-ignore
      actions$ = of(Actions.executeRunSuccess({ result: { strange: 'object' } }));
      const spy = vi.spyOn(store, 'dispatch');

      effects.handleExecutionSuccess$.subscribe();

      expect(spy).not.toHaveBeenCalled();
      expect(notificationServiceMock.success).not.toHaveBeenCalled();
    });
  });

  describe('handleExecutionFailure$', () => {
    it('should show an error toast', () => {
      actions$ = of(Actions.executeRunFailure({ error: 'Test error' }));

      effects.handleExecutionFailure$.subscribe();

      expect(notificationServiceMock.error).toHaveBeenCalledWith('Execution failed: Test error');
    });
  });

  describe('initApiDocsState$', () => {
    it('should dispatch setApiDocsVisibility and resizeApiDocsPane based on localStorage', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
        if (key === 'apiDocsVisible') return 'true';
        if (key === 'apiDocsPaneHeight') return '400';
        return null;
      });

      actions$ = of({ type: ROOT_EFFECTS_INIT });
      const spy = vi.spyOn(store, 'dispatch');

      const result = await effects.initApiDocsState$.toPromise();
      expect(spy).toHaveBeenCalledWith(Actions.setApiDocsVisibility({ visible: true }));
      expect(spy).toHaveBeenCalledWith(Actions.resizeApiDocsPane({ height: 400 }));
      expect(result).toEqual({ type: '[Workspace] Init Docs State Complete' });
    });

    it('should not dispatch if localStorage is empty', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

      actions$ = of({ type: ROOT_EFFECTS_INIT });
      const spy = vi.spyOn(store, 'dispatch');

      const result = await effects.initApiDocsState$.toPromise();
      expect(spy).not.toHaveBeenCalledWith(Actions.setApiDocsVisibility({ visible: true }));
      expect(spy).not.toHaveBeenCalledWith(Actions.resizeApiDocsPane({ height: 400 }));
      expect(result).toEqual({ type: '[Workspace] Init Docs State Complete' });
    });
  });

  describe('syncApiDocsVisibility$', () => {
    it('should save visibility to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      store.overrideSelector(selectIsApiDocsVisible, true);

      actions$ = of(Actions.toggleApiDocsPane());
      effects.syncApiDocsVisibility$.subscribe();

      expect(setItemSpy).toHaveBeenCalledWith('apiDocsVisible', 'true');
    });
  });

  describe('syncApiDocsHeight$', () => {
    it('should save height to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      store.overrideSelector(selectApiDocsPaneHeight, 500);

      actions$ = of(Actions.resizeApiDocsPane({ height: 500 }));
      effects.syncApiDocsHeight$.subscribe();

      expect(setItemSpy).toHaveBeenCalledWith('apiDocsPaneHeight', '500');
    });
  });
});
