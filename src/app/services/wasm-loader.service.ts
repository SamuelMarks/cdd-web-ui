import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';

import { BackendConfigService } from './backend-config.service';

/** Map of ecosystem names to their respective GitHub WASM release URLs. */
export const WASM_GITHUB_URLS: Record<string, string> = {
  'cdd-c': 'https://github.com/SamuelMarks/cdd-c/releases/latest/download/cdd-c.wasm',
  'cdd-cpp': 'https://github.com/SamuelMarks/cdd-cpp/releases/latest/download/cdd-cpp.wasm',
  'cdd-csharp':
    'https://github.com/SamuelMarks/cdd-csharp/releases/latest/download/cdd-csharp.wasm',
  'cdd-csharp-wasm.zip':
    'https://github.com/SamuelMarks/cdd-csharp/releases/latest/download/cdd-csharp-wasm.zip',
  'cdd-go': 'https://github.com/SamuelMarks/cdd-go/releases/latest/download/cdd-go.wasm',
  'cdd-java.js.wasm':
    'https://github.com/SamuelMarks/cdd-java/releases/latest/download/cdd-java.js.wasm',
  'cdd-java.js': 'https://github.com/SamuelMarks/cdd-java/releases/latest/download/cdd-java.js',
  'cdd-java': 'https://github.com/SamuelMarks/cdd-java/releases/latest/download/cdd-java.wasm',
  'cdd-kotlin': 'https://github.com/offscale/cdd-kotlin/releases/latest/download/cdd-kotlin.wasm',
  'cdd-php': 'https://github.com/SamuelMarks/cdd-php/releases/latest/download/cdd-php.wasm',
  'cdd-python-all':
    'https://github.com/offscale/cdd-python-all/releases/latest/download/cdd-python-all.wasm',
  'cdd-ruby': 'https://github.com/SamuelMarks/cdd-ruby/releases/latest/download/cdd-ruby.wasm',
  'cdd-rust': 'https://github.com/offscale/cdd-rust/releases/latest/download/cdd-rust.wasm',
  'cdd-sh': 'https://github.com/SamuelMarks/cdd-sh/releases/latest/download/cdd-sh.wasm',
  'cdd-swift': 'https://github.com/SamuelMarks/cdd-swift/releases/latest/download/cdd-swift.wasm',
  'cdd-ts': 'https://github.com/offscale/cdd-ts/releases/latest/download/cdd-ts-javy.wasm',
  'cdd-ts.js': 'https://github.com/offscale/cdd-ts/releases/latest/download/cdd-ts.js',
};

/** List of all supported WASM ecosystems. */
export const WASM_ECOSYSTEMS = Object.keys(WASM_GITHUB_URLS);

/**
 * Service responsible for asynchronously loading WASM binaries.
 */
@Injectable({
  providedIn: 'root',
})
/** WasmLoaderService */
export class WasmLoaderService {
  /** Cache of loaded WASM binaries to prevent re-fetching. */
  private binaryCache = new Map<string, ArrayBuffer>();
  /** The backend config service. */
  private config = inject(BackendConfigService);
  /** The MatDialog service. */
  private dialog = inject(MatDialog);
  /** Whether the user has approved loading WASM from GitHub. */
  private hasApprovedWasmLoad = false;
  /** The Document token. */
  private doc = inject(DOCUMENT, { optional: true });

  /**
   * Gets the remote GitHub URL for a WASM binary.
   */
  getGithubWasmUrl(ecosystem: string): string {
    return WASM_GITHUB_URLS[ecosystem] || '';
  }

  /**
   * Parses the GitHub URL to determine the local path.
   */
  getLocalWasmPath(githubUrl: string): string {
    const filename = githubUrl.split('/').pop() || '';
    return `./assets/wasm/${filename}`;
  }

  /**
   * Gets the correct URL for a WASM binary or JS file.
   */
  getEnvUrl(ecosystem: string): string {
    const githubUrl = this.getGithubWasmUrl(ecosystem);
    if (!githubUrl) return '';
    return this.getLocalWasmPath(githubUrl);
  }

  /**
   * Fetches the WASM binary or JS file from the correct environment URL.
   */
  private async fetchWasmResponse(ecosystem: string): Promise<Response> {
    const url = this.getEnvUrl(ecosystem);
    if (!url) {
      throw new Error(`No URL configured for ecosystem: ${ecosystem}`);
    }
    return fetch(url);
  }

  /**
   * Preloads all WASM binaries.
   */
  async preloadAllWasm(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    let loadedCount = 0;
    const totalCount = WASM_ECOSYSTEMS.length;

    // Concurrently fetch all WASMs to speed up the process, but limit concurrency if needed.
    // For simplicity, we fire them all.
    await Promise.all(
      WASM_ECOSYSTEMS.map(async (ecosystem) => {
        if (ecosystem === 'cdd-csharp' || ecosystem === 'cdd-csharp-wasm.zip') {
          loadedCount++;
          if (onProgress) {
            onProgress(loadedCount, totalCount);
          }
          return;
        }
        try {
          const response = await this.fetchWasmResponse(ecosystem);
          if (!response.ok) {
            console.warn(`Failed to preload ${ecosystem}: ${response.statusText}`);
            return;
          }
          const buffer = await response.arrayBuffer();
          this.binaryCache.set(ecosystem, buffer);
        } catch (err) {
          console.error(`Failed to preload ${ecosystem}:`, err);
        } finally {
          loadedCount++;
          if (onProgress) {
            onProgress(loadedCount, totalCount);
          }
        }
      }),
    );

    this.hasApprovedWasmLoad = true;
  }

  /**
   * Asynchronously loads a WASM binary by language name.
   * Caches the result to optimize future loads.
   *
   * @param ecosystem The target ecosystem name (e.g., 'cdd-python-all').
   * @returns A Promise resolving to the WASM binary as an ArrayBuffer.
   * @throws Error if the WASM file is missing, incompatible, or fetch fails.
   */
  async loadWasmBinary(ecosystem: string): Promise<ArrayBuffer> {
    if (this.binaryCache.has(ecosystem)) {
      return this.binaryCache.get(ecosystem) as ArrayBuffer;
    }

    try {
      const response = await this.fetchWasmResponse(ecosystem);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `WASM binary not found for ${ecosystem}. Ensure it is generated and available.`,
          );
        }
        throw new Error(`Failed to load WASM binary for ${ecosystem}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (
        contentType &&
        !contentType.includes('wasm') &&
        !contentType.includes('application/octet-stream')
      ) {
        console.warn(`Unexpected content-type for WASM binary: ${contentType}. Continuing anyway.`);
      }

      const buffer = await response.arrayBuffer();

      const view = new Uint8Array(buffer);
      const magic =
        view.length >= 4 ? (view[0] << 24) | (view[1] << 16) | (view[2] << 8) | view[3] : 0;
      const isWasm = magic === 0x0061736d;
      const isZip = magic === 0x504b0304;

      if (!isWasm && !isZip) {
        throw new Error(`Invalid WASM binary downloaded for ${ecosystem}: Missing magic number.`);
      }

      this.binaryCache.set(ecosystem, buffer);
      return buffer;
    } catch (error) {
      console.error(`Error loading WASM binary for ${ecosystem}:`, error);
      throw error;
    }
  }

  /**
   * Clears the WASM binary cache. Useful for testing or forcing a refresh.
   */
  clearCache(): void {
    this.binaryCache.clear();
  }
}
