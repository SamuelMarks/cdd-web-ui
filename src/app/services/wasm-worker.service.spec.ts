import { TestBed } from '@angular/core/testing';
import { WasmWorkerService } from './wasm-worker.service';
import { WasmLoaderService } from './wasm-loader.service';
import { LoggingService } from './logging.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  postMessage(data: { action?: string; payload?: { specContent?: string } }): void {
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
              data: { status: 'error', error: 'Unknown action' },
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
      action?: string;
      payload?: { specContent?: string };
    }) {
      if (this.onmessage) {
        this.onmessage(
          new MessageEvent('message', {
            data: { status: 'error' },
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
      action?: string;
      payload?: { specContent?: string };
    }) {
      if (this.onmessage) {
        this.onmessage(
          new MessageEvent('message', {
            data: { status: 'error', error: 'WASM crashed' },
          }),
        );
      }
    };
    (service as unknown as { worker: Worker | null }).worker = errorWorker as unknown as Worker;

    await expect(service.generateCode('cdd-python-all', '{}')).rejects.toThrow('WASM crashed');
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
});
