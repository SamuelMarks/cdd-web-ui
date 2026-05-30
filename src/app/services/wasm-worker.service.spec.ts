import { TestBed } from '@angular/core/testing';
import { WasmWorkerService } from './wasm-worker.service';
import { WasmLoaderService } from './wasm-loader.service';
import { LoggingService } from './logging.service';
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
  let originalWorker: typeof Worker;

  beforeEach(() => {
    mockLoaderService = {
      loadWasmBinary: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      getCddJavaJsUrl: vi.fn().mockReturnValue('mock-url'),
      getCddJavaWasmUrl: vi.fn().mockReturnValue('mock-wasm-url'),
    };
    mockLoggingService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    originalWorker = globalThis.Worker;
    globalThis.Worker = MockWorker as unknown as typeof Worker;

    TestBed.configureTestingModule({
      providers: [
        { provide: WasmLoaderService, useValue: mockLoaderService },
        { provide: LoggingService, useValue: mockLoggingService },
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

  it('should return generated files on success', async () => {
    const files = await service.generateCode('cdd-python-all', '{}');
    expect(files.length).toBe(1);
    expect(files[0].path).toBe('test.ts');
    expect(mockLoaderService.loadWasmBinary).toHaveBeenCalledWith('cdd-python-all');
  });

  it('should handle log messages and pass to LoggingService', async () => {
    const files = await service.generateCode('cdd-python-all', 'log_test');
    expect(files.length).toBe(1);
    expect(mockLoggingService.info).toHaveBeenCalledWith('Info test');
    expect(mockLoggingService.warn).toHaveBeenCalledWith('Warn test');
    expect(mockLoggingService.error).toHaveBeenCalledWith('Error test');
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
        // Send a message with a wrong jobId first
        this.onmessage(
          new MessageEvent('message', {
            data: {
              status: 'success',
              jobId: 'wrong-job-id',
              data: [{ path: 'wrong.ts', content: new Uint8Array([9]) }],
            },
          }),
        );
        // Send the correct one
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
    // @ts-ignore
    delete globalThis.Worker;
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
    const capturedPayloads: any[] = [];
    const originalPostMessage = MockWorker.prototype.postMessage;
    MockWorker.prototype.postMessage = function (data: any) {
      if (data.action === 'generateSdk') {
        capturedPayloads.push(data.payload);
      }
      originalPostMessage.call(this, data);
    };

    const files = await service.generateCode('cdd-ruby', '{}', 'to_docs_json', { noImports: true });
    expect(capturedPayloads.length).toBe(1);
    expect(capturedPayloads[0].target).toBe('to_docs_json');
    expect(capturedPayloads[0].languageOptions.noImports).toBe(true);

    MockWorker.prototype.postMessage = originalPostMessage;
  });

  it('should pass options to generateCode when target is to_docs_json', async () => {
    const mockWorker = new MockWorker();
    let capturedPayload: unknown = null;
    mockWorker.postMessage = function (data) {
      capturedPayload = data.payload;
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
    expect(capturedPayload.target).toBe('to_docs_json');
    expect(capturedPayload.languageOptions).toBe(options);
  });
});
