/**
 * Web Worker and remote MCP/RPC orchestration service for executing compilers off the main thread.
 * @module app/services/wasm-worker.service
 */
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WasmLoaderService } from './wasm-loader.service';
import { LoggingService } from './logging.service';
import { BackendConfigService } from './backend-config.service';
import { McpRpcService } from './mcp-rpc.service';

/**
 * Interface representing a generated file from WASM or remote MCP execution.
 */
export interface GeneratedFile {
  /** File path */
  path: string;
  /** Binary content */
  content: Uint8Array;
}

/**
 * Service to communicate with the WASM Web Worker or remote `cdd-gateway` / `cdd-engine` MCP/RPC endpoints.
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
  /** Optional BackendConfigService for checking online execution mode. */
  private config = inject(BackendConfigService, { optional: true });
  /** Optional McpRpcService for remote JSON-RPC and MCP compiler execution. */
  private mcpRpc = inject(McpRpcService, { optional: true });
  /** The worker instance. */
  private worker: Worker | null = null;
  /** Error captured if the Web Worker fails during initial script/module loading. */
  private workerLoadError: Error | null = null;
  /** Set of active in-flight job IDs used to deduplicate worker log broadcasts. */
  private activeJobIds = new Set<string>();

  /**
   * Initializes the Web Worker if supported by the browser.
   */
  constructor() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./wasm-worker.worker', import.meta.url), {
        type: 'module',
      });
      this.worker.addEventListener('error', (event: ErrorEvent): void => {
        this.workerLoadError = new Error(event.message || 'Web Worker failed to load.');
      });
    } else {
      console.warn(
        'Web Workers are not supported in this environment. WASM operations may block UI.',
      );
    }
  }

  /**
   * Generates code remotely via `cdd-gateway` JSON-RPC (`/rpc`) or MCP (`/mcp/message`) endpoints.
   * @param ecosystem Target ecosystem (e.g. `'cdd-rust'`).
   * @param specContent The OpenAPI specification content.
   * @param target The target generation type (`to_sdk`, `to_server`, `to_sdk_cli`, `to_docs_json`).
   * @param languageOptions The language specific options.
   * @returns Promise resolving to the array of generated files.
   */
  async generateCodeRemote(
    ecosystem: string,
    specContent: string,
    target: string = 'to_sdk',
    languageOptions: Record<string, unknown> = {},
  ): Promise<GeneratedFile[]> {
    if (!this.mcpRpc) {
      throw new Error('McpRpcService is not available.');
    }

    const encoder = new TextEncoder();
    if (target === 'to_docs_json') {
      const targetLang = ecosystem.replace(/^cdd-/, '').replace(/-all$/, '');
      const result = await firstValueFrom(
        this.mcpRpc.rpcToDocsJson({
          target_language: targetLang,
          input: specContent,
          no_imports: Boolean(languageOptions['noImports']),
          no_wrapping: Boolean(languageOptions['noWrapping']),
        }),
      );
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return [{ path: 'docs.json', content: encoder.encode(text) }];
    }

    const toolRes = await firstValueFrom(
      this.mcpRpc.mcpCallTool(ecosystem, {
        target,
        spec: specContent,
        options: languageOptions,
      }),
    );

    const firstBlock = toolRes.content?.[0]?.text ?? '';
    return [{ path: `${ecosystem}/output.txt`, content: encoder.encode(firstBlock) }];
  }

  /**
   * Generates code from OpenAPI using remote MCP/RPC when online in `cdd-engine` mode,
   * or using WASM in a browser Web Worker thread.
   * @param ecosystem Target ecosystem (e.g. 'cdd-python-all')
   * @param specContent The OpenAPI specification content
   * @param target The target generation type (to_sdk, to_server, to_sdk_cli, to_docs_json)
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
    const mode = this.config?.runMode?.();
    if (
      this.config?.isOnline?.() &&
      this.mcpRpc &&
      (mode === 'local_cdd_ctl_wasm' || mode === 'local_cdd_ctl_native')
    ) {
      try {
        return await this.generateCodeRemote(ecosystem, specContent, target, languageOptions);
      } catch {
        // Fall back to local Web Worker WASM if remote execution fails
      }
    }

    if (!this.worker) {
      throw new Error('Web Worker not initialized.');
    }
    if (this.workerLoadError) {
      throw this.workerLoadError;
    }

    let wasmBinary: ArrayBuffer | undefined;
    if (ecosystem !== 'cdd-csharp') {
      wasmBinary = await this.loaderService.loadWasmBinary(ecosystem);
    }

    return new Promise((resolve, reject) => {
      const jobId = Math.random().toString(36).substring(7);
      this.activeJobIds.add(jobId);

      const cleanup = (): void => {
        this.activeJobIds.delete(jobId);
        this.worker?.removeEventListener('message', handleMessage);
        this.worker?.removeEventListener('error', handleError);
      };

      const handleError = (event: ErrorEvent): void => {
        cleanup();
        reject(new Error(event.message || 'Web Worker error'));
      };

      // One-off message handler for this request
      const handleMessage = (event: MessageEvent): void => {
        const { status, data, error, level, message, jobId: responseJobId } = event.data;
        if (status === 'log') {
          if (this.activeJobIds.values().next().value === jobId) {
            if (level === 'INFO') {
              this.loggingService.info(message);
            } else if (level === 'WARN') {
              this.loggingService.warn(message);
            } else if (level === 'ERROR') {
              this.loggingService.error(message);
            }
          }
          return; // Do not resolve or reject, keep listening
        }

        if (responseJobId !== jobId) {
          return; // Ignore messages from other jobs
        }

        cleanup();
        if (status === 'success') {
          resolve(data as GeneratedFile[]);
        } else {
          reject(new Error(error || 'Unknown worker error'));
        }
      };

      this.worker!.addEventListener('message', handleMessage);
      this.worker!.addEventListener('error', handleError);

      this.worker!.postMessage({
        action: 'generateSdk',
        jobId,
        payload: {
          ecosystem,
          specContent,
          wasmBinary,
          target,
          languageOptions,
          cddJavaJsUrl: new URL(this.loaderService.getEnvUrl('cdd-java.js'), document.baseURI).href,
          cddJavaWasmUrl: new URL(this.loaderService.getEnvUrl('cdd-java'), document.baseURI).href,
          cddCsharpDirUrl: new URL('./assets/wasm/cdd-csharp/', document.baseURI).href,
        },
      });
    });
  }

  /**
   * Terminates the worker. Useful for cleanup.
   */
  terminate(): void {
    this.activeJobIds.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
