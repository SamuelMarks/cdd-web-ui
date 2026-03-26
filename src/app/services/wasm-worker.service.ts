import { Injectable, inject } from '@angular/core';
import { WasmLoaderService } from './wasm-loader.service';
import { LoggingService } from './logging.service';

/**
 * Interface representing a generated file from WASM.
 */
export interface GeneratedFile {
  /** File path */
  path: string;
  /** Binary content */
  content: Uint8Array;
}

/**
 * Service to communicate with the WASM Web Worker, ensuring main thread UI is not blocked.
 */
@Injectable({
  providedIn: 'root',
})
/** WasmWorkerService */
export class WasmWorkerService {
  /** The WasmLoaderService instance to fetch binaries. */
  private loaderService = inject(WasmLoaderService);
  /** The LoggingService to log messages from worker. */
  private loggingService = inject(LoggingService);
  /** The worker instance. */
  private worker: Worker | null = null;

  /**
   * Initializes the Web Worker if supported by the browser.
   */
  constructor() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./wasm-worker.worker', import.meta.url), {
        type: 'module',
      });
    } else {
      console.warn(
        'Web Workers are not supported in this environment. WASM operations may block UI.',
      );
    }
  }

  /**
   * Generates code from OpenAPI using WASM in a worker thread.
   * @param ecosystem Target ecosystem (e.g. 'cdd-python')
   * @param specContent The OpenAPI specification content
   * @param target The target generation type (to_sdk, to_server, to_sdk_cli)
   * @param languageOptions The language specific options
   * @returns Array of generated files
   */
  async generateCode(
    /** ecosystem */
    ecosystem: string,
    /** specContent */
    specContent: string,
    /** target */
    target: string = 'to_sdk',
    /** languageOptions */
    languageOptions: Record<string, unknown> = {},
  ): Promise<GeneratedFile[]> {
    if (!this.worker) {
      throw new Error('Web Worker not initialized.');
    }

    const wasmBinary = await this.loaderService.loadWasmBinary(ecosystem);

    return new Promise((resolve, reject) => {
      // One-off message handler for this request
      const handleMessage = (event: MessageEvent) => {
        const { status, data, error, level, message } = event.data;
        if (status === 'log') {
          if (level === 'INFO') {
            this.loggingService.info(message);
          } else if (level === 'WARN') {
            this.loggingService.warn(message);
          } else if (level === 'ERROR') {
            this.loggingService.error(message);
          }
          return; // Do not resolve or reject, keep listening
        }

        if (status === 'success') {
          resolve(data as GeneratedFile[]);
        } else {
          reject(new Error(error || 'Unknown worker error'));
        }
        this.worker?.removeEventListener('message', handleMessage);
      };

      this.worker!.addEventListener('message', handleMessage);

      // We clone the ArrayBuffer so we can transfer it to the worker
      // Actually passing it by reference is fine for small WASMs unless we transfer list
      this.worker!.postMessage({
        action: 'generateSdk',
        payload: {
          ecosystem,
          specContent,
          wasmBinary,
          target,
          languageOptions,
        },
      });
    });
  }

  /**
   * Terminates the worker. Useful for cleanup.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
