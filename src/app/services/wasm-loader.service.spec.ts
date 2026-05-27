import { BackendConfigService } from './backend-config.service';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WasmLoaderService, WASM_GITHUB_URLS } from './wasm-loader.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

describe('WasmLoaderService', () => {
  let service: WasmLoaderService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    const mockConfig = {
      runMode: signal('local_relative'),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: BackendConfigService, useValue: mockConfig },
        {
          provide: MatDialog,
          useValue: { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) },
        },
      ],
    });

    service = TestBed.inject(WasmLoaderService);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    service.clearCache();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load a valid WASM binary and cache it', async () => {
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

    // Update fetch mock to succeed for local fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);

    // Mock WASM_GITHUB_URLS map dynamically if needed, but it's hardcoded. We will use a real one.
    const buffer = await service.loadWasmBinary('cdd-ts');
    expect(new Uint8Array(buffer)).toEqual(mockWasmData);

    // First try: local fetch, so 1 call
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('/assets/wasm/cdd-ts.wasm');

    // Second call should use cache
    const cachedBuffer = await service.loadWasmBinary('cdd-ts');
    expect(new Uint8Array(cachedBuffer)).toEqual(mockWasmData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should fallback to GitHub if local fetch fails with 404', async () => {
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

    // Provide a mocked fetch that fails on local URLs but succeeds on github URLs
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('/assets/')) {
        return {
          ok: false,
          status: 404,
        };
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/wasm' }),
        arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
      };
    });

    const buffer = await service.loadWasmBinary('cdd-ts');
    expect(new Uint8Array(buffer)).toEqual(mockWasmData);

    // It should have tried local path, then github path
    expect(globalThis.fetch).toHaveBeenCalledWith('/assets/wasm/cdd-ts.wasm');
    expect(globalThis.fetch).toHaveBeenCalledWith(WASM_GITHUB_URLS['cdd-ts']);
  });

  it('should fallback to GitHub if local fetch throws network error', async () => {
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

    // Provide a mocked fetch that fails on local URLs but succeeds on github URLs
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('/assets/')) {
        throw new Error('Network error');
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/wasm' }),
        arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
      };
    });

    const buffer = await service.loadWasmBinary('cdd-ts');
    expect(new Uint8Array(buffer)).toEqual(mockWasmData);

    // It should have tried local path, then github path
    expect(globalThis.fetch).toHaveBeenCalledWith('/assets/wasm/cdd-ts.wasm');
    expect(globalThis.fetch).toHaveBeenCalledWith(WASM_GITHUB_URLS['cdd-ts']);
  });

  it('should throw an error if both local and GitHub fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-ts')).rejects.toThrow(
      /WASM binary not found for cdd-ts/,
    );

    // It should have tried local path and github path
    expect(globalThis.fetch).toHaveBeenCalledWith('/assets/wasm/cdd-ts.wasm');
    expect(globalThis.fetch).toHaveBeenCalledWith(WASM_GITHUB_URLS['cdd-ts']);
  });

  it('should throw an error for non-404 fetch failures after fallback', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('/assets/')) {
        return {
          ok: false,
          status: 404,
        };
      }
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };
    });

    await expect(service.loadWasmBinary('cdd-ts')).rejects.toThrow(
      /Failed to load WASM binary for cdd-ts: Internal Server Error/,
    );
  });

  it('should check fallbackLocalPath for Java', async () => {
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

    // Provide a mocked fetch that fails for cdd-java.js.wasm but succeeds for cdd-java.wasm
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/assets/wasm/cdd-java.js.wasm') {
        return {
          ok: false,
          status: 404,
        };
      }
      if (url === '/assets/wasm/cdd-java.wasm') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/wasm' }),
          arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
        };
      }
      return { ok: false, status: 404 };
    });

    const buffer = await service.loadWasmBinary('cdd-java');
    expect(new Uint8Array(buffer)).toEqual(mockWasmData);

    expect(globalThis.fetch).toHaveBeenCalledWith('/assets/wasm/cdd-java.js.wasm');
    expect(globalThis.fetch).toHaveBeenCalledWith('/assets/wasm/cdd-java.wasm');
    // Should NOT have called Github
    expect(globalThis.fetch).not.toHaveBeenCalledWith(WASM_GITHUB_URLS['cdd-java']);
  });

  it('should throw an error if no GitHub URL is configured for the ecosystem', async () => {
    await expect(service.loadWasmBinary('unknown-ecosystem')).rejects.toThrow(
      /No GitHub URL configured for ecosystem: unknown-ecosystem/,
    );
  });

  it('should warn if the content-type is unexpected but still return the buffer', async () => {
    const consoleSpy = vi.spyOn(console, 'warn');
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);

    await service.loadWasmBinary('cdd-ts');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Unexpected content-type for WASM binary: text/html. Continuing anyway.',
      ),
    );
  });

  it('should throw if the WASM binary misses the magic number', async () => {
    const invalidData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(invalidData.buffer),
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-ts')).rejects.toThrow(
      /Invalid WASM binary downloaded for cdd-ts: Missing magic number/,
    );
  });

  it('should throw if the WASM binary is too short', async () => {
    const shortData = new Uint8Array([0x00]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(shortData.buffer),
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-ts')).rejects.toThrow(
      /Invalid WASM binary downloaded for cdd-ts: Missing magic number/,
    );
  });

  it('should preload all WASM binaries', async () => {
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);

    const progressCallback = vi.fn();
    await service.preloadAllWasm(progressCallback);
    expect(progressCallback).toHaveBeenCalled();
  });

  it('should handle errors in preloadAllWasm when 404', async () => {
    const consoleSpy = vi.spyOn(console, 'warn');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as unknown as Response);

    await service.preloadAllWasm();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to preload cdd-ts: Not Found'),
    );
  });

  it('should handle thrown errors in preloadAllWasm', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await service.preloadAllWasm();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to preload cdd-ts:'),
      expect.any(Error),
    );
  });

  it('should return correct cdd-java.js URL', () => {
    const url = service.getCddJavaJsUrl();
  });

  it('should return correct cdd-java.js.wasm URL', () => {
    const url = service.getCddJavaWasmUrl();
  });
});
