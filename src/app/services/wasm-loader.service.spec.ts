import { BackendConfigService } from './backend-config.service';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WasmLoaderService } from './wasm-loader.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('WasmLoaderService', () => {
  let service: WasmLoaderService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    const mockConfig = {
      runMode: signal('local_relative'),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: BackendConfigService, useValue: mockConfig }],
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

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);

    const buffer = await service.loadWasmBinary('cdd-test');
    expect(new Uint8Array(buffer)).toEqual(mockWasmData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const cachedBuffer = await service.loadWasmBinary('cdd-test');
    expect(new Uint8Array(cachedBuffer)).toEqual(mockWasmData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if the fetch fails (e.g. 404)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-missing')).rejects.toThrow(
      /WASM binary not found for cdd-missing/,
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw an error for non-404 fetch failures', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-error')).rejects.toThrow(
      /Failed to load WASM binary for cdd-error: Internal Server Error/,
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should warn but proceed if content-type is unexpected', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);

    const buffer = await service.loadWasmBinary('cdd-weird');
    expect(new Uint8Array(buffer)).toEqual(mockWasmData);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected content-type for WASM binary'),
    );

    consoleWarnSpy.mockRestore();
  });

  it('should throw an error if the binary magic number is invalid', async () => {
    const mockInvalidData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockInvalidData.buffer),
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-invalid')).rejects.toThrow(
      /Invalid WASM binary downloaded for cdd-invalid: Missing magic number./,
    );
  });

  it('should throw an error if the binary is neither WASM nor ZIP but has length >= 4', async () => {
    const mockInvalidData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockInvalidData.buffer),
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-invalid2')).rejects.toThrow(
      /Invalid WASM binary downloaded for cdd-invalid2: Missing magic number./,
    );
  });

  it('should throw an error if the binary is less than 4 bytes', async () => {
    const mockInvalidData = new Uint8Array([0x01, 0x02]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockInvalidData.buffer),
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-short')).rejects.toThrow(
      /Invalid WASM binary downloaded for cdd-short: Missing magic number./,
    );
  });

  it('should allow valid ZIP files', async () => {
    const mockZipData = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/zip' }),
      arrayBuffer: () => Promise.resolve(mockZipData.buffer),
    } as unknown as Response);

    const buffer = await service.loadWasmBinary('cdd-zip');
    expect(buffer.byteLength).toBe(4);
  });

  it('should clear the cache', async () => {
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);

    await service.loadWasmBinary('cdd-clear');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    service.clearCache();

    await service.loadWasmBinary('cdd-clear');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('should use served_github url for cdd-python', async () => {
    const config = TestBed.inject(BackendConfigService);
    config.runMode.set('served_github');
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);
    await service.loadWasmBinary('cdd-python');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://github.com/offscale/cdd-python/releases/latest/download/python.wasm',
    );
  });

  it('should use served_github url for default', async () => {
    const config = TestBed.inject(BackendConfigService);
    config.runMode.set('served_github');
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);
    await service.loadWasmBinary('cdd-rust');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://github.com/SamuelMarks/cdd-rust/releases/latest/download/rust.wasm',
    );
  });

  it('should fallback to local url in local_cdd_ctl_native mode', async () => {
    const config = TestBed.inject(BackendConfigService);
    config.runMode.set('local_cdd_ctl_native');
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);
    await service.loadWasmBinary('cdd-rust');
    expect(globalThis.fetch).toHaveBeenCalledWith('/assets/wasm/cdd-rust.wasm');
  });
});
