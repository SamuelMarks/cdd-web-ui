import { TestBed } from '@angular/core/testing';
import { WasmWorkerService } from './wasm-worker.service';
import { WasmLoaderService } from './wasm-loader.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  postMessage(data: unknown): void {
    if (data.action === 'generateSdk') {
      // Simulate async processing
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage(new MessageEvent('message', {
            data: { status: 'success', data: [{ path: 'test.ts', content: new Uint8Array([1, 2, 3]) }] }
          }));
        }
      }, 0);
    } else {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage(new MessageEvent('message', {
            data: { status: 'error', error: 'Unknown action' }
          }));
        }
      }, 0);
    }
  }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'message') {
      this.onmessage = listener;
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
  let originalWorker: typeof Worker;

  beforeEach(() => {
    mockLoaderService = {
      loadWasmBinary: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    };
    
    // Save original Worker to restore later
    originalWorker = global.Worker;
    (global as never).Worker = MockWorker;

    TestBed.configureTestingModule({
      providers: [
        { provide: WasmLoaderService, useValue: mockLoaderService }
      ]
    });
    service = TestBed.inject(WasmWorkerService);
  });

  afterEach(() => {
    global.Worker = originalWorker;
    service.terminate();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return generated files on success', async () => {
    const files = await service.generateCode('cdd-python', '{}');
    expect(files.length).toBe(1);
    expect(files[0].path).toBe('test.ts');
    expect(mockLoaderService.loadWasmBinary).toHaveBeenCalledWith('cdd-python');
  });

  it('should handle worker errors without explicit message', async () => {
    const errorWorker = new MockWorker();
    errorWorker.postMessage = function(data: unknown) {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', {
          data: { status: 'error' } // no error string
        }));
      }
    };
    (service as never).worker = errorWorker;
    
    await expect(service.generateCode('cdd-python', '{}')).rejects.toThrow('Unknown worker error');
  });

  it('should handle worker errors', async () => {
    const errorWorker = new MockWorker();
    errorWorker.postMessage = function(data: unknown) {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', {
          data: { status: 'error', error: 'WASM crashed' }
        }));
      }
    };
    (service as never).worker = errorWorker;
    
    await expect(service.generateCode('cdd-python', '{}')).rejects.toThrow('WASM crashed');
  });

  it('should throw an error if worker is missing (e.g. environment without workers)', async () => {
    (service as never).worker = null;
    await expect(service.generateCode('cdd-python', '{}')).rejects.toThrow('Web Worker not initialized.');
  });

  it('should log warning if Worker is undefined', () => {
    const origWorker = global.Worker;
    // @ts-ignore
    delete global.Worker;
    const warnSpy = vi.spyOn(console, 'warn');
    
    TestBed.resetTestingModule();
    
    const loaderService = new WasmLoaderService(null as never);
    TestBed.configureTestingModule({
      providers: [
        { provide: WasmLoaderService, useValue: loaderService }
      ]
    });
    
    const svc = TestBed.inject(WasmWorkerService);
    
    expect(warnSpy).toHaveBeenCalledWith('Web Workers are not supported in this environment. WASM operations may block UI.');
    
    global.Worker = origWorker;
    warnSpy.mockRestore();
  });
});
