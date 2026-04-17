import { Injectable } from '@angular/core';

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

  /**
   * Asynchronously loads a WASM binary by language name.
   * Caches the result to optimize future loads.
   *
   * @param ecosystem The target ecosystem name (e.g., 'cdd-python').
   * @returns A Promise resolving to the WASM binary as an ArrayBuffer.
   * @throws Error if the WASM file is missing, incompatible, or fetch fails.
   */
  async loadWasmBinary(ecosystem: string): Promise<ArrayBuffer> {
    if (this.binaryCache.has(ecosystem)) {
      return this.binaryCache.get(ecosystem) as ArrayBuffer;
    }

    try {
      // Load from local assets for offline support
      const response = await fetch(`/assets/wasm/${ecosystem}.wasm`);

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
      const isWasm = view.length >= 4 && view[0] === 0x00 && view[1] === 0x61 && view[2] === 0x73 && view[3] === 0x6d;
      const isZip = view.length >= 4 && view[0] === 0x50 && view[1] === 0x4B && view[2] === 0x03 && view[3] === 0x04;

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
