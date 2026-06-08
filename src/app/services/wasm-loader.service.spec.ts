import { BackendConfigService } from './backend-config.service';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { WasmLoaderService } from './wasm-loader.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

describe('WasmLoaderService', () => {
  let service: WasmLoaderService;
  let originalFetch: typeof fetch;

  let mockDocument: Document;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockDocument = {
      location: { hostname: 'localhost' },
    };

    const mockConfig = {
      runMode: signal('local_relative'),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: BackendConfigService, useValue: mockConfig },
        { provide: DOCUMENT, useValue: mockDocument },
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
    });

    // Mock WASM_GITHUB_URLS map dynamically if needed, but it's hardcoded. We will use a real one.
    const buffer = await service.loadWasmBinary('cdd-ts');
    expect(new Uint8Array(buffer)).toEqual(mockWasmData);

    // First try: local fetch, so 1 call
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/assets/wasm/cdd-ts-javy.wasm'),
    );

    // Second call should use cache
    const cachedBuffer = await service.loadWasmBinary('cdd-ts');
    expect(new Uint8Array(cachedBuffer)).toEqual(mockWasmData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should fetch from localhost when running locally', async () => {
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    });

    mockDocument.location.hostname = 'localhost';

    await service.loadWasmBinary('cdd-ts');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/assets/wasm/cdd-ts-javy.wasm'),
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should fetch from GitHub when running remotely', async () => {
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    });

    mockDocument.location.hostname = 'example.com';

    await service.loadWasmBinary('cdd-ts');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/assets/wasm/cdd-ts-javy.wasm'),
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    mockDocument.location.hostname = 'localhost';

    await expect(service.loadWasmBinary('cdd-ts')).rejects.toThrow(
      /WASM binary not found for cdd-ts/,
    );
  });

  it('should throw an error for non-404 fetch failures', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    mockDocument.location.hostname = 'example.com';

    await expect(service.loadWasmBinary('cdd-ts')).rejects.toThrow(
      /Failed to load WASM binary for cdd-ts: Internal Server Error/,
    );
  });

  it('should throw an error if no GitHub URL is configured for the ecosystem', async () => {
    await expect(service.loadWasmBinary('unknown-ecosystem')).rejects.toThrow(
      'No URL configured for ecosystem: unknown-ecosystem',
    );
  });

  it('should warn if the content-type is unexpected but still return the buffer', async () => {
    const consoleSpy = vi.spyOn(console, 'warn');
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    });

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
    });

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
    });

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
    });

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
    });

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

  it('should return correct getEnvUrl for local and remote environments', () => {
    mockDocument.location.hostname = 'localhost';
    let url = service.getEnvUrl('cdd-java.js');
    expect(url).toBe('./assets/wasm/cdd-java.js');

    mockDocument.location.hostname = 'example.com';
    url = service.getEnvUrl('cdd-java.js');
    expect(url).toBe('./assets/wasm/cdd-java.js');

    // Invalid ecosystem
    const invalidUrl = service.getEnvUrl('invalid');
    expect(invalidUrl).toBe('');

    // Empty split
    const emptySplit = service.getLocalWasmPath('http://example.com/');
    expect(emptySplit).toBe('./assets/wasm/');
  });
});
