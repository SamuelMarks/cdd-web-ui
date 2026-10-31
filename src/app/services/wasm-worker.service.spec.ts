import { TestBed } from '@angular/core/testing';
import { WasmWorkerService } from './wasm-worker.service';
import { WasmLoaderService } from './wasm-loader.service';
import { LoggingService } from './logging.service';
import { BackendConfigService } from './backend-config.service';
import { McpRpcService } from './mcp-rpc.service';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  postMessage(data: { jobId?: string; action?: string; payload?: { specContent?: string } }): void {
    if (data.action === 'generateSdk') {
      setTimeout(() => {
        if (this.onmessage) {
          if (data.payload?.specContent === 'log_test') {
            this.onmessage(
              new MessageEvent('message', {
                data: { status: 'log', level: 'INFO', message: 'Info test' },
              }),
            );
            this.onmessage(
              new MessageEvent('message', {
                data: { status: 'log', level: 'WARN', message: 'Warn test' },
              }),
            );
            this.onmessage(
              new MessageEvent('message', {
                data: { status: 'log', level: 'ERROR', message: 'Error test' },
              }),
            );
            this.onmessage(
              new MessageEvent('message', {
                data: { status: 'log', level: 'UNKNOWN', message: 'Unknown test' },
              }),
            );
          }
          this.onmessage(
            new MessageEvent('message', {
              data: {
                status: 'success',
                jobId: data.jobId,
                data: [{ path: 'test.ts', content: new Uint8Array([1, 2, 3]) }],
              },
            }),
          );
        }
      }, 0);
    } else {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage(
            new MessageEvent('message', {
              data: { status: 'error', jobId: data.jobId, error: 'Unknown action' },
            }),
          );
        }
      }, 0);
    }
  }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'message') {
      this.onmessage = listener as (ev: MessageEvent) => void;
    }
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'message' && this.onmessage === listener) {
      this.onmessage = null;
    }
  }
  terminate(): void {}
}

describe('WasmWorkerService', () => {
  let service: WasmWorkerService;
  let mockLoaderService: Partial<WasmLoaderService>;
  let mockLoggingService: Partial<LoggingService>;
  let mockConfig: {
    isOnline: ReturnType<typeof signal<boolean>>;
    runMode: ReturnType<typeof signal<string>>;
  };
  let mockMcpRpc: {
    rpcToDocsJson: ReturnType<typeof vi.fn>;
    mcpCallTool: ReturnType<typeof vi.fn>;
  };
  let originalWorker: typeof Worker;

  beforeEach(() => {
    mockLoaderService = {
      loadWasmBinary: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      getEnvUrl: vi.fn((key) => {
        if (key === 'cdd-java.js') return 'mock-url';
        if (key === 'cdd-java.js.wasm') return 'mock-wasm-url';
        return '';
      }),
    };
    mockLoggingService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockConfig = {
      isOnline: signal(false),
      runMode: signal('local_relative'),
    };
    mockMcpRpc = {
      rpcToDocsJson: vi.fn(),
      mcpCallTool: vi.fn(),
    };

    originalWorker = globalThis.Worker;
    globalThis.Worker = MockWorker as unknown as typeof Worker;

    TestBed.configureTestingModule({
      providers: [
        { provide: WasmLoaderService, useValue: mockLoaderService },
        { provide: LoggingService, useValue: mockLoggingService },
        { provide: BackendConfigService, useValue: mockConfig },
        { provide: McpRpcService, useValue: mockMcpRpc },
      ],
    });
    service = TestBed.inject(WasmWorkerService);
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
    service.terminate();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should execute generateCodeRemote for to_docs_json and mcpCallTool when online in cdd-engine mode, or fall back to worker on failure', async () => {
    mockConfig.isOnline.set(true);
    mockConfig.runMode.set('local_cdd_ctl_wasm');

    // Object result from rpcToDocsJson
    mockMcpRpc.rpcToDocsJson.mockReturnValue(of({ endpoints: [] }));
    const docsFiles1 = await service.generateCode('cdd-python-all', '{}', 'to_docs_json', {
      noImports: true,
    });
    expect(docsFiles1[0].path).toBe('docs.json');

    // String result from rpcToDocsJson
    mockMcpRpc.rpcToDocsJson.mockReturnValue(of('{"raw":true}'));
    const docsFiles2 = await service.generateCode('cdd-rust', '{}', 'to_docs_json');
    expect(docsFiles2[0].path).toBe('docs.json');

    // MCP tool call for to_sdk in local_cdd_ctl_native mode
    mockConfig.runMode.set('local_cdd_ctl_native');
    mockMcpRpc.mcpCallTool.mockReturnValue(
      of({ content: [{ type: 'text', text: 'pub fn sdk() {}' }] }),
    );
    const sdkFiles = await service.generateCode('cdd-rust', '{}', 'to_sdk');
    expect(sdkFiles[0].path).toBe('cdd-rust/output.txt');

    // Online with local_relative mode uses local worker directly
    mockConfig.runMode.set('local_relative');
    const localRelFiles = await service.generateCode('cdd-rust', '{}', 'to_sdk');
    expect(localRelFiles[0].path).toBe('test.ts');
    mockConfig.runMode.set('local_cdd_ctl_wasm');

    // Empty content array from mcpCallTool
    mockMcpRpc.mcpCallTool.mockReturnValue(of({ content: [] }));
    const emptyFiles = await service.generateCodeRemote('cdd-rust', '{}');
    expect(emptyFiles[0].content.byteLength).toBe(0);

    // Fallback to local WASM worker when remote call fails
    mockMcpRpc.mcpCallTool.mockReturnValue(throwError(() => new Error('Remote failed')));
    const fallbackFiles = await service.generateCode('cdd-rust', '{}', 'to_sdk');
    expect(fallbackFiles[0].path).toBe('test.ts');

    // Missing mcpRpc throws in generateCodeRemote
    (service as unknown as { mcpRpc: McpRpcService | null }).mcpRpc = null;
    await expect(service.generateCodeRemote('cdd-rust', '{}')).rejects.toThrow(
      'McpRpcService is not available.',
    );
  });

  it('should return generated files on success', async () => {
    const files = await service.generateCode('cdd-python-all', '{}');
    expect(files.length).toBe(1);
    expect(files[0].path).toBe('test.ts');
    expect(mockLoaderService.loadWasmBinary).toHaveBeenCalledWith('cdd-python-all');
  });

  it('should not call loadWasmBinary if ecosystem is cdd-csharp', async () => {
    const files = await service.generateCode('cdd-csharp', '{}');
    expect(files.length).toBe(1);
    expect(files[0].path).toBe('test.ts');
    expect(mockLoaderService.loadWasmBinary).not.toHaveBeenCalled();
  });

  it('should handle log messages and pass to LoggingService', async () => {
    const files = await service.generateCode('cdd-python-all', 'log_test');
    expect(files.length).toBe(1);
    expect(mockLoggingService.info).toHaveBeenCalledWith('Info test');
    expect(mockLoggingService.warn).toHaveBeenCalledWith('Warn test');
    expect(mockLoggingService.error).toHaveBeenCalledWith('Error test');
  });

  it('should cover terminate', () => {
    if ((service as unknown as { worker: Worker | null }).worker) {
      (service as unknown as { worker: Worker | null }).worker?.terminate();
    }
  });

  it('should handle worker errors without explicit message', async () => {
    const errorWorker = new MockWorker();
    errorWorker.postMessage = function (data: {
      jobId?: string;
      action?: string;
      payload?: { specContent?: string };
    }) {
      if (this.onmessage) {
        this.onmessage(
          new MessageEvent('message', {
            data: { status: 'error', jobId: data.jobId },
          }),
        );
      }
    };
    (service as unknown as { worker: Worker | null }).worker = errorWorker as unknown as Worker;

    await expect(service.generateCode('cdd-python-all', '{}')).rejects.toThrow(
      'Unknown worker error',
    );
  });

  it('should handle worker errors', async () => {
    const errorWorker = new MockWorker();
    errorWorker.postMessage = function (data: {
      jobId?: string;
      action?: string;
      payload?: { specContent?: string };
    }) {
      if (this.onmessage) {
        this.onmessage(
          new MessageEvent('message', {
            data: { status: 'error', jobId: data.jobId, error: 'WASM crashed' },
          }),
        );
      }
    };
    (service as unknown as { worker: Worker | null }).worker = errorWorker as unknown as Worker;

    await expect(service.generateCode('cdd-python-all', '{}')).rejects.toThrow('WASM crashed');
  });

  it('should ignore messages with a different jobId', async () => {
    const mixedJobIdWorker = new MockWorker();
    mixedJobIdWorker.postMessage = function (data: {
      jobId?: string;
      action?: string;
      payload?: { specContent?: string };
    }) {
      if (this.onmessage) {
        this.onmessage(
          new MessageEvent('message', {
            data: {
              status: 'success',
              jobId: 'wrong-job-id',
              data: [{ path: 'wrong.ts', content: new Uint8Array([9]) }],
            },
          }),
        );
        this.onmessage(
          new MessageEvent('message', {
            data: {
              status: 'success',
              jobId: data.jobId,
              data: [{ path: 'right.ts', content: new Uint8Array([1]) }],
            },
          }),
        );
      }
    };
    (service as unknown as { worker: Worker | null }).worker =
      mixedJobIdWorker as unknown as Worker;

    const files = await service.generateCode('cdd-python-all', '{}');
    expect(files.length).toBe(1);
    expect(files[0].path).toBe('right.ts');
  });

  it('should throw an error if worker is missing (e.g. environment without workers)', async () => {
    (service as unknown as { worker: Worker | null }).worker = null;
    await expect(service.generateCode('cdd-python-all', '{}')).rejects.toThrow(
      'Web Worker not initialized.',
    );
  });

  it('should log warning if Worker is undefined', () => {
    const origWorker = globalThis.Worker;
    Reflect.deleteProperty(globalThis, 'Worker');
    const warnSpy = vi.spyOn(console, 'warn');

    TestBed.resetTestingModule();

    const loaderServiceMock = { loadWasmBinary: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: WasmLoaderService, useValue: loaderServiceMock },
        { provide: LoggingService, useValue: mockLoggingService },
      ],
    });

    TestBed.inject(WasmWorkerService);

    expect(warnSpy).toHaveBeenCalledWith(
      'Web Workers are not supported in this environment. WASM operations may block UI.',
    );

    globalThis.Worker = origWorker;
    warnSpy.mockRestore();
  });

  it('should explicitly inject -o docs.json and handle to_docs_json target', async () => {
    const capturedPayloads: { target: string; languageOptions: { noImports?: boolean } }[] = [];
    const originalPostMessage = MockWorker.prototype.postMessage;
    MockWorker.prototype.postMessage = function (data: {
      action?: string;
      payload?: { target: string; languageOptions: { noImports?: boolean } };
    }) {
      if (data.action === 'generateSdk' && data.payload) {
        capturedPayloads.push(data.payload);
      }
      originalPostMessage.call(this, data);
    };

    await service.generateCode('cdd-ruby', '{}', 'to_docs_json', { noImports: true });
    expect(capturedPayloads.length).toBe(1);
    expect(capturedPayloads[0].target).toBe('to_docs_json');
    expect(capturedPayloads[0].languageOptions.noImports).toBe(true);

    MockWorker.prototype.postMessage = originalPostMessage;
  });

  it('should pass options to generateCode when target is to_docs_json', async () => {
    const mockWorker = new MockWorker();
    let capturedPayload: { target?: string; languageOptions?: unknown } | null = null;
    mockWorker.postMessage = function (data: {
      jobId?: string;
      payload?: { target?: string; languageOptions?: unknown };
    }) {
      capturedPayload = data.payload ?? null;
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage(
            new MessageEvent('message', {
              data: {
                status: 'success',
                jobId: data.jobId,
                data: [{ path: 'docs.json', content: new Uint8Array([1]) }],
              },
            }),
          );
        }
      }, 0);
    };
    (service as unknown as { worker: Worker | null }).worker = mockWorker as unknown as Worker;
    const options = { noImports: true, noWrapping: true };
    const files = await service.generateCode('cdd-ruby', '{}', 'to_docs_json', options);
    expect(files.length).toBe(1);
    expect(capturedPayload?.target).toBe('to_docs_json');
    expect(capturedPayload?.languageOptions).toBe(options);
  });

  it('should ignore messages from other jobs', async () => {
    const ignoreWorker = new MockWorker();
    ignoreWorker.postMessage = function (data: { jobId?: string }) {
      if (this.onmessage) {
        this.onmessage(
          new MessageEvent('message', {
            data: { status: 'success', jobId: 'unrelated-job-id', data: [] },
          }),
        );
        this.onmessage(
          new MessageEvent('message', {
            data: { status: 'success', jobId: data.jobId, data: [{ path: 'test.ts' }] },
          }),
        );
      }
    };
    (service as unknown as { worker: Worker | null }).worker = ignoreWorker as unknown as Worker;

    const result = await service.generateCode('cdd-python-all', 'spec', 'to_sdk');
    expect(result.length).toBe(1);
    expect(result[0].path).toBe('test.ts');
  });

  it('should reject when worker emits an error event and deduplicate concurrent job logs', async () => {
    const listeners: {
      message: ((ev: MessageEvent) => void)[];
      error: ((ev: ErrorEvent) => void)[];
    } = { message: [], error: [] };

    const multiWorker = {
      addEventListener: vi.fn(
        (type: 'message' | 'error', cb: EventListenerOrEventListenerObject) => {
          if (type === 'message') listeners.message.push(cb as (ev: MessageEvent) => void);
          if (type === 'error') listeners.error.push(cb as (ev: ErrorEvent) => void);
        },
      ),
      removeEventListener: vi.fn(),
      postMessage: vi.fn((data: { jobId: string; payload: { target: string } }) => {
        if (data.payload.target === 'error-with-msg') {
          listeners.error.forEach((cb) =>
            cb({ message: 'Failed to resolve module' } as ErrorEvent),
          );
        } else if (data.payload.target === 'error-empty-msg') {
          listeners.error.forEach((cb) => cb({ message: '' } as ErrorEvent));
        }
      }),
      terminate: vi.fn(),
    };

    (service as unknown as { worker: Worker | null }).worker = multiWorker as unknown as Worker;

    await expect(service.generateCode('cdd-c', '{}', 'error-with-msg')).rejects.toThrow(
      'Failed to resolve module',
    );
    await expect(service.generateCode('cdd-c', '{}', 'error-empty-msg')).rejects.toThrow(
      'Web Worker error',
    );

    listeners.message = [];
    listeners.error = [];
    const jobIds: string[] = [];
    multiWorker.postMessage = vi.fn((data: { jobId: string }) => {
      jobIds.push(data.jobId);
      if (jobIds.length === 2) {
        const logEvent = new MessageEvent('message', {
          data: { status: 'log', level: 'INFO', message: 'Dedup log' },
        });
        listeners.message.forEach((cb) => cb(logEvent));
        for (const id of jobIds) {
          const doneEvent = new MessageEvent('message', {
            data: { status: 'success', jobId: id, data: [] },
          });
          listeners.message.forEach((cb) => cb(doneEvent));
        }
      }
    });

    await Promise.all([
      service.generateCode('cdd-c', '{}', 'to_sdk'),
      service.generateCode('cdd-c', '{}', 'to_docs_json'),
    ]);

    expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.info).toHaveBeenCalledWith('Dedup log');
  });

  it('should reject generateCode if worker emitted an error during initialization', async () => {
    let capturedInitErrorCb: ((ev: ErrorEvent) => void) | null = null;
    class InitErrorWorker extends MockWorker {
      override addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
        super.addEventListener(type, listener);
        if (type === 'error' && !capturedInitErrorCb) {
          capturedInitErrorCb = listener as (ev: ErrorEvent) => void;
        }
      }
    }

    globalThis.Worker = InitErrorWorker as unknown as typeof Worker;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: WasmLoaderService, useValue: mockLoaderService },
        { provide: LoggingService, useValue: mockLoggingService },
      ],
    });
    const initService = TestBed.inject(WasmWorkerService);
    expect(capturedInitErrorCb).toBeTruthy();

    capturedInitErrorCb!({ message: 'Module load failed' } as ErrorEvent);
    await expect(initService.generateCode('cdd-c', '{}')).rejects.toThrow('Module load failed');

    capturedInitErrorCb!({ message: '' } as ErrorEvent);
    await expect(initService.generateCode('cdd-c', '{}')).rejects.toThrow(
      'Web Worker failed to load.',
    );
  });
});
