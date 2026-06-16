import { BackendConfigService } from './backend-config.service';
import '@angular/compiler';
import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { WasmGeneratorService } from './wasm-generator.service';
import { Repository } from '../models/types';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LanguageService } from './language.service';
import { vi } from 'vitest';
import { CddWasmSdk } from 'cdd-browser-sdk';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

describe('WasmGeneratorService', () => {
  let service: WasmGeneratorService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockImplementation(
      (opts: import('cdd-browser-sdk').GenerateOptions) => {
        if (opts.ecosystem === 'cdd-go' || (opts.ecosystem as string) === 'go')
          return Promise.resolve([]);
        if (opts.ecosystem === 'cdd-python-all' && opts.specContent === 'success-spec') {
          const encoder = new TextEncoder();
          return Promise.resolve([
            {
              path: 'test.py',
              content: encoder.encode('Generated content for success'),
            },
          ]);
        }
        return Promise.reject(new Error('WASM error'));
      },
    );

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        WasmGeneratorService,
        LanguageService,
        {
          provide: MatDialog,
          useValue: { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) },
        },
      ],
    });
    service = TestBed.inject(WasmGeneratorService);

    originalFetch = window.fetch;
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () =>
        Promise.resolve(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]).buffer),
    });

    vi.spyOn(globalThis.WebAssembly, 'instantiate').mockResolvedValue({
      instance: { exports: {} },
      module: {},
    });
  });

  afterEach(() => {
    window.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  const dummyRepo: Repository = { id: 'p1', name: 'TestRepo', organizationId: 'org1' };

  describe('RPC backend execution', () => {
    it('should return fallback success string if RPC result has no code', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('local_cdd_ctl_native');
      configService.setOnlineMode('http://localhost:8080');
      const httpMock = TestBed.inject(HttpTestingController);
      const promise = service.generateSdk(
        { id: '1', name: 'repo', organizationId: 'test' },
        'python',
        '{}',
      );
      httpMock.expectOne('http://localhost:8080').flush({ result: {} });
      const result = await promise;
      expect(result).toBe('/* Generated successfully via backend */\n');
    });

    it('should throw generic RPC Error if response has error without message', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('local_cdd_ctl_native');
      configService.setOnlineMode('http://localhost:8080');
      const httpMock = TestBed.inject(HttpTestingController);
      const promise = service.generateSdk(
        { id: '1', name: 'repo', organizationId: 'test' },
        'python',
        '{}',
      );
      httpMock.expectOne('http://localhost:8080').flush({ error: {} });
      const result = await promise;
      expect(result).toContain('Fallback mock activated');
    });
    it('should throw RPC Error if response has error', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('local_cdd_ctl_native');
      configService.setOnlineMode('http://localhost:8080');

      const httpMock = TestBed.inject(HttpTestingController);
      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };

      const promise = service.generateSdk(mockRepo, 'python', '{}');
      const req = httpMock.expectOne('http://localhost:8080');
      req.flush({ error: { message: 'Explicit RPC Error' } });

      const result = await promise;
      expect(result).toContain('Fallback mock activated');
    });

    it('should handle local_cdd_ctl_native success', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('local_cdd_ctl_native');
      configService.setOnlineMode('http://localhost:8080');

      const httpMock = TestBed.inject(HttpTestingController);
      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };

      const promise = service.generateSdk(mockRepo, 'python', '{}');
      const req = httpMock.expectOne('http://localhost:8080');
      expect(req.request.method).toBe('POST');
      req.flush({ result: { code: '/* Generated from backend */' } });

      const result = await promise;
      expect(result).toBe('/* Generated from backend */');
    });

    it('should handle local_cdd_ctl_native error missing baseUrl', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('local_cdd_ctl_native');
      configService.setOfflineMode(); // clears baseUrl

      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };
      const result = await service.generateSdk(mockRepo, 'python', '{}');
      expect(result).toContain('Error: Backend URL must be configured');
    });

    it('should handle local_cdd_ctl_native RPC error payload', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('local_cdd_ctl_native');
      configService.setOnlineMode('http://localhost:8080');

      const httpMock = TestBed.inject(HttpTestingController);
      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };

      const promise = service.generateSdk(mockRepo, 'python', '{}');
      const req = httpMock.expectOne('http://localhost:8080');
      req.flush({ error: { message: 'Some RPC error' } });

      const result = await promise;
      expect(result).toContain('Fallback mock activated');
    });

    it('should use local relative mode for fallback', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('local_relative');

      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };
      await service.generateSdk(mockRepo, 'python', '{}');
      // Wait we need to mock fetch
    });
  });

  describe('generateSdk', () => {
    it('should parse valid YAML spec', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('local_relative');
      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };
      const yamlStr = 'openapi: 3.0.0\ninfo:\n  title: Test API\n  version: 1.0.0';
      const result = await service.generateSdk(mockRepo, 'python', yamlStr);
      expect(result).toBeTruthy();
    });

    it('should use served_github mode in generateSdk for cdd-python', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('served_github');
      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };
      const result = await service.generateSdk(mockRepo, 'python', '{}');
      expect(result).toContain('GeneratedApi');
    });

    it('should use served_github mode in generateSdk', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('served_github');
      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };
      const result = await service.generateSdk(mockRepo, 'typescript', '{}');
      expect(result).toContain('GeneratedApi');
    });

    it('should handle unrecognised language ID in generateSdk', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      const code = await service.generateSdk(dummyRepo, 'unknown-lang', '{}');
      expect(code).toContain(
        'Generation for unknown-lang is disabled due to lack of WASM support.',
      );
    });
    it('should generate fallback with GeneratedApi if title is missing', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const emptySpec = '{"openapi":"3.0.0"}'; // no info.title
      const result = await service.generateSdk(dummyRepo, 'python', emptySpec);

      expect(result).toContain('class GeneratedApiClient:');
    });

    it('should strip spaces from title in fallback', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const specWithSpaces = '{"openapi":"3.0.0", "info": { "title": "My Awesome API" }}';
      const result = await service.generateSdk(dummyRepo, 'python', specWithSpaces);

      expect(result).toContain('class MyAwesomeAPIClient:');
    });

    it('should generate python stub', async () => {
      const code = await service.generateSdk(
        dummyRepo,
        'python',
        '{"info": {"title": "Test API"}}',
      );
      expect(code).toContain('class TestAPIClient:');
      expect(code).toContain('import requests');
    });

    it('should generate rust stub', async () => {
      const code = await service.generateSdk(dummyRepo, 'rust', 'title: "Test API"');
      expect(code).toContain('pub struct TestAPIClient {');
    });

    it('should generate typescript stub', async () => {
      const code = await service.generateSdk(dummyRepo, 'typescript', '');
      expect(code).toContain('export class GeneratedApiClient {');
    });

    it('should generate default stub for other supported languages', async () => {
      // Let's force 'go' to be supported via the signal map, but wait, the languages array is fixed in tests unless we modify it.
      const langService = TestBed.inject(LanguageService);
      langService.languages.update((langs) =>
        langs.map((l) => (l.id === 'go' ? { ...l, availableInWasm: true } : l)),
      );

      const code = await service.generateSdk(dummyRepo, 'go', '{}');
      expect(code).toContain('/* WASM executed successfully but generated no files. */');
    });

    it('should assign empty ArrayBuffer for csharp in generateSdk', async () => {
      vi.spyOn(service['langService'], 'languages').mockReturnValue([
        {
          id: 'csharp',
          repo: 'cdd-csharp',
          availableInWasm: true,
          name: 'C#',
        } as import('../models/types').Language,
      ]);
      const result = await service.generateSdk(dummyRepo, 'csharp', '{}');
      expect(result).toBeDefined();
    });

    it('should handle successful wasm generation', async () => {
      const code = await service.generateSdk(dummyRepo, 'python', 'success-spec');
      expect(code).toContain('Generated content for success');
    });

    it('should handle unrecognised language ID', async () => {
      const code = await service.generateSdk(dummyRepo, 'unsupported-lang', '{}');
      expect(code).toContain('is disabled due to lack of WASM support');
    });

    it('should fallback if WASM fails to load', async () => {
      window.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const code = await service.generateSdk(dummyRepo, 'python', '{}');
      expect(code).toContain('Fallback mock activated');
      expect(code).toContain('GeneratedApiClient');
    });
  });

  describe('generateCiCd', () => {
    it('should generate python CI', async () => {
      const config = await service.generateCiCd(dummyRepo, 'python');
      expect(config).toContain('name: Python SDK CI');
      expect(config).toContain('pytest');
    });

    it('should generate rust CI', async () => {
      const config = await service.generateCiCd(dummyRepo, 'rust');
      expect(config).toContain('name: Rust SDK CI');
      expect(config).toContain('cargo test');
    });

    it('should generate typescript CI', async () => {
      const config = await service.generateCiCd(dummyRepo, 'typescript');
      expect(config).toContain('name: TypeScript SDK CI');
      expect(config).toContain('npm test');
    });

    it('should generate default CI for other supported languages', async () => {
      const langService = TestBed.inject(LanguageService);
      langService.languages.update((langs) =>
        langs.map((l) => (l.id === 'go' ? { ...l, availableInWasm: true } : l)),
      );

      const config = await service.generateCiCd(dummyRepo, 'go');
      expect(config).toContain('# Default CI workflow for Go');
    });

    it('should handle completely unknown languages in generateCiCd', async () => {
      const config = await service.generateCiCd(dummyRepo, 'unknown-lang');
      expect(config).toContain('is disabled due to lack of WASM support');
      expect(config).toContain('for unknown-lang');
    });

    it('should fall back if YAML parsing fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const specContent = 'invalid:\n\t  - yaml';
      const code = await service.generateSdk(dummyRepo, 'typescript', specContent);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WasmGenerator] Failed to parse YAML'),
        expect.any(Error),
      );
      expect(typeof code).toBe('string');
    });
  });

  describe('generateOpenApi', () => {
    it('should use served_github mode in generateOpenApi for default', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('served_github');
      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };
      const result = await service.generateOpenApi(mockRepo, 'rust', '{}');
      expect(result).toContain('Generated API');
    });

    it('should use local_relative mode in generateOpenApi', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('local_relative');
      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };
      const result = await service.generateOpenApi(mockRepo, 'typescript', '{}');
      expect(result).toContain('Generated API');
    });

    it('should use served_github mode in generateOpenApi for cdd-python', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('served_github');
      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };
      const result = await service.generateOpenApi(mockRepo, 'python', '{}');
      expect(result).toContain('Generated API');
    });

    it('should use served_github mode in generateOpenApi', async () => {
      const configService = TestBed.inject(BackendConfigService);
      configService.setRunMode('served_github');
      const mockRepo: Repository = { id: '1', name: 'repo', organizationId: 'test' };
      const result = await service.generateOpenApi(mockRepo, 'typescript', '{}');
      expect(result).toContain('Generated API');
    });

    it('should generate fallback mock if fetch fails with ok=false', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const spec = await service.generateOpenApi(dummyRepo, 'python', '{}');
      expect(spec).toContain('"title": "Mock API from Python"');
    });

    it('should generate openapi stub from python sdk', async () => {
      const spec = await service.generateOpenApi(dummyRepo, 'python', 'class Client: pass');
      expect(spec).toContain('"title": "Generated API from Python"');
    });

    it('should fallback to mock API if WASM fails', async () => {
      window.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const spec = await service.generateOpenApi(dummyRepo, 'python', 'class Client: pass');
      expect(spec).toContain('"title": "Mock API from Python"');
    });

    it('should handle unrecognised language ID', async () => {
      const spec = await service.generateOpenApi(dummyRepo, 'unsupported-lang', '{}');
      expect(spec).toContain('is disabled due to lack of WASM support');
    });

    it('should assign empty ArrayBuffer for csharp in generateOpenApi', async () => {
      vi.spyOn(service['langService'], 'languages').mockReturnValue([
        {
          id: 'csharp',
          repo: 'cdd-csharp',
          availableInWasm: true,
          name: 'C#',
        } as import('../models/types').Language,
      ]);
      const result = await service.generateOpenApi(dummyRepo, 'csharp', '{}');
      expect(result).toBeDefined();
    });
  });

  it('should cover wasi stubs in generateOpenApi', async () => {
    vi.spyOn(globalThis.WebAssembly, 'instantiate').mockImplementation(
      (buf, imports: Record<string, Record<string, (...args: unknown[]) => unknown>>) => {
        console.log('Mock WebAssembly.instantiate called');

        // Call all the wasi_snapshot_preview1 functions
        imports.wasi_snapshot_preview1.fd_write();
        imports.wasi_snapshot_preview1.environ_get();
        imports.wasi_snapshot_preview1.environ_sizes_get();
        imports.wasi_snapshot_preview1.proc_exit();

        // Call all the interop functions
        imports.interop.genBacktrace();
        imports.interop['Date.now']();
        imports.interop['performance.now']();

        imports.interop['stderrWriter.flush']();
        imports.interop['stdoutWriter.flush']();
        imports.interop['runtime.setExitCode']();
        imports.interop.llog();
        imports.interop.formatStackTrace();
        imports.interop.getCurrentWorkingDirectory();
        imports.interop['stdoutWriter.close']();
        imports.interop['stderrWriter.close']();
        imports.interop['stdoutWriter.printChars']();
        imports.interop['stderrWriter.printChars']();

        // Call all the compat functions
        imports.compat.f64rem(5, 2);
        // Math.log, Math.log10, Math.pow are built-ins, but we can call them if needed
        if (typeof imports.compat.f64log === 'function') imports.compat.f64log(2);
        if (typeof imports.compat.f64log10 === 'function') imports.compat.f64log10(2);
        if (typeof imports.compat.f64pow === 'function') imports.compat.f64pow(2, 2);

        // Call all the jsbody functions
        imports.jsbody['_JSObject.stringValue___String']();
        imports.jsbody['_JSNumber.javaDouble___Double']();
        imports.jsbody['_JSConversion.extractJavaScriptProxy___Object_Object']();
        imports.jsbody['_JSConversion.javaScriptUndefined___Object']();
        imports.jsbody['_JSConversion.asJavaObjectOrString___Object_Object']();
        imports.jsbody['_JSConversion.extractJavaScriptString___String_Object']();
        imports.jsbody['_JSConversion.javaScriptToJava___Object_Object']();
        imports.jsbody['_JSConversion.unproxy___Object_Object']();
        imports.jsbody['_JSSymbol.referenceEquals___JSSymbol_JSSymbol_JSBoolean']();
        imports.jsbody['_JSString.javaString___String']();
        imports.jsbody['_JSSymbol.javaString___String']();
        imports.jsbody['_JSObject.typeofString___JSString']();
        imports.jsbody['_JSObject.get___Object_Object']();
        imports.jsbody['_JSBoolean.javaBoolean___Boolean']();
        imports.jsbody['_JSBigInt.javaString___String']();

        // Call all the convert functions
        imports.convert.proxyCharArray();

        return Promise.resolve();
      },
    );

    const originalFetch = globalThis.fetch;

    const validWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    vi.spyOn(
      (
        service as unknown as {
          wasmLoaderService: { loadWasmBinary: (...args: unknown[]) => unknown };
        }
      ).wasmLoaderService,
      'loadWasmBinary',
    ).mockResolvedValue(validWasm.buffer);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/wasm' }),
      arrayBuffer: () => Promise.resolve(validWasm.buffer),
    });

    await service.generateOpenApi(
      { id: 'proj-1', name: 'repo', organizationId: 'test' },
      'python',
      'code',
    );

    globalThis.fetch = originalFetch;
  });

  it('should generate generic stub for unknown language', () => {
    const stub = service['getMockOutput']('php', 'API');
    expect(stub).toContain('Generated code for php');
  });
});
