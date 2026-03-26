import { TestBed } from '@angular/core/testing';
import { WasmLoaderService } from './wasm-loader.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('WasmLoaderService', () => {
  let service: WasmLoaderService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WasmLoaderService);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    service.clearCache();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load a valid WASM binary and cache it', async () => {
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);

    const buffer = await service.loadWasmBinary('cdd-test');
    expect(new Uint8Array(buffer)).toEqual(mockWasmData);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const cachedBuffer = await service.loadWasmBinary('cdd-test');
    expect(new Uint8Array(cachedBuffer)).toEqual(mockWasmData);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if the fetch fails (e.g. 404)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-missing')).rejects.toThrow(
      /WASM binary not found for cdd-missing/,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw an error for non-404 fetch failures', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-error')).rejects.toThrow(
      /Failed to load WASM binary for cdd-error: Internal Server Error/,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should warn but proceed if content-type is unexpected', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);

    global.fetch = vi.fn().mockResolvedValue({
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

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockInvalidData.buffer),
    } as unknown as Response);

    await expect(service.loadWasmBinary('cdd-invalid')).rejects.toThrow(
      /Invalid WASM binary downloaded for cdd-invalid: Missing magic number./,
    );
  });

  it('should clear the cache', async () => {
    const mockWasmData = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(mockWasmData.buffer),
    } as unknown as Response);

    await service.loadWasmBinary('cdd-clear');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    service.clearCache();

    await service.loadWasmBinary('cdd-clear');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
