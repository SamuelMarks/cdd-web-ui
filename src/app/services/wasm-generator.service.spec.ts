import '@angular/compiler';
import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { WasmGeneratorService } from './wasm-generator.service';
import { Repository } from '../models/types';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { LanguageService } from './language.service';
import { vi } from 'vitest';

describe('WasmGeneratorService', () => {
  let service: WasmGeneratorService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [WasmGeneratorService, LanguageService],
    });
    service = TestBed.inject(WasmGeneratorService);

    originalFetch = window.fetch;
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });

    window.WebAssembly.instantiate = vi.fn().mockResolvedValue({
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

  describe('generateSdk', () => {
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
      expect(code).toContain('export class UnknownAPIClient {');
    });

    it('should generate default stub for other supported languages', async () => {
      // Let's force 'go' to be supported via the signal map, but wait, the languages array is fixed in tests unless we modify it.
      const langService = TestBed.inject(LanguageService);
      langService.languages.update((langs) =>
        langs.map((l) => (l.id === 'go' ? { ...l, availableInWasm: true } : l)),
      );

      const code = await service.generateSdk(dummyRepo, 'go', '{}');
      expect(code).toContain('/* Generated code for go */');
    });

    it('should return disabled message for unsupported languages', async () => {
      const code = await service.generateSdk(dummyRepo, 'java', '{}');
      expect(code).toContain('is disabled due to lack of WASM support');
    });

    it('should handle unrecognised language ID', async () => {
      const code = await service.generateSdk(dummyRepo, 'unsupported-lang', '{}');
      expect(code).toContain('is disabled due to lack of WASM support');
    });

    it('should fallback if WASM fails to load', async () => {
      window.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const code = await service.generateSdk(dummyRepo, 'python', '{}');
      expect(code).toContain('Fallback mock activated');
      expect(code).toContain('UnknownAPIClient');
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

    it('should return disabled message for unsupported languages', async () => {
      const config = await service.generateCiCd(dummyRepo, 'java');
      expect(config).toContain('is disabled due to lack of WASM support');
    });
  });

  describe('generateOpenApi', () => {
    it('should generate openapi stub from python sdk', async () => {
      const spec = await service.generateOpenApi(dummyRepo, 'python', 'class Client: pass');
      expect(spec).toContain('"title": "Generated API from Python"');
    });

    it('should fallback to mock API if WASM fails', async () => {
      window.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const spec = await service.generateOpenApi(dummyRepo, 'python', 'class Client: pass');
      expect(spec).toContain('"title": "Mock API from Python"');
    });

    it('should return disabled message for unsupported languages', async () => {
      const spec = await service.generateOpenApi(dummyRepo, 'java', 'class Client {}');
      expect(spec).toContain('is disabled due to lack of WASM support');
    });

    it('should handle unrecognised language ID', async () => {
      const spec = await service.generateOpenApi(dummyRepo, 'unsupported-lang', '{}');
      expect(spec).toContain('is disabled due to lack of WASM support');
    });
  });
});
