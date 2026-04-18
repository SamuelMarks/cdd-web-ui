import { Injectable, inject } from '@angular/core';
import { BackendConfigService } from './backend-config.service';

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
      // Load from local assets for offline support

      let url = `/assets/wasm/${ecosystem}.wasm`;
      const runMode = this.config.runMode();

      if (runMode === 'served_github') {
        const repoOrg =
          ecosystem.startsWith('cdd-python') || ecosystem === 'cdd-ts' || ecosystem === 'cdd-kotlin'
            ? 'offscale'
            : 'SamuelMarks';
        // Note: github releases format for cdd-* repos
        url = `https://github.com/${repoOrg}/${ecosystem}/releases/latest/download/${ecosystem.replace('cdd-', '')}.wasm`;
      } else if (runMode === 'local_cdd_ctl_wasm' || runMode === 'local_cdd_ctl_native') {
        // When using cdd-ctl backend, we might not even need the browser to download WASM if we use RPC.
        // But if we still do, we could fetch from the backend url.
        // Assuming we just use local assets as fallback if runMode is backend but WASM is requested in browser.
        url = `/assets/wasm/${ecosystem}.wasm`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `WASM binary not found for ${ecosystem}. Ensure it is generated and available in public/assets/wasm.`,
          );
        }
        throw new Error(`Failed to load WASM binary for ${ecosystem}: ${response.statusText}`);
      }

      // Ensure the content type is somewhat correct, though local dev servers might serve it as octet-stream
      const contentType = response.headers.get('content-type');
      if (
        contentType &&
        !contentType.includes('wasm') &&
        !contentType.includes('application/octet-stream')
      ) {
        console.warn(`Unexpected content-type for WASM binary: ${contentType}. Continuing anyway.`);
      }

      const buffer = await response.arrayBuffer();

      // Basic check for WASM magic number (\0asm) or ZIP magic number (PK\x03\x04) for Pyodide bundles
      const view = new Uint8Array(buffer);
      const isWasm =
        view.length >= 4 &&
        view[0] === 0x00 &&
        view[1] === 0x61 &&
        view[2] === 0x73 &&
        view[3] === 0x6d;
      const isZip =
        view.length >= 4 &&
        view[0] === 0x50 &&
        view[1] === 0x4b &&
        view[2] === 0x03 &&
        view[3] === 0x04;

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
