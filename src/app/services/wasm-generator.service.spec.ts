import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { WasmGeneratorService } from './wasm-generator.service';
import { Repository } from '../models/types';

describe('WasmGeneratorService', () => {
  let service: WasmGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WasmGeneratorService);
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

    it('should return disabled message for unsupported languages', async () => {
      const code = await service.generateSdk(dummyRepo, 'java', '{}');
      expect(code).toContain('is disabled due to lack of WASM support');
    });

    it('should handle unrecognised language ID', async () => {
      const code = await service.generateSdk(dummyRepo, 'unknown-lang', '{}');
      expect(code).toContain('is disabled due to lack of WASM support');
    });
  });

  describe('generateOpenApi', () => {
    it('should generate openapi stub from python sdk', async () => {
      const spec = await service.generateOpenApi(dummyRepo, 'python', 'class Client: pass');
      expect(spec).toContain('"title": "Generated API from Python"');
    });

    it('should return disabled message for unsupported languages', async () => {
      const spec = await service.generateOpenApi(dummyRepo, 'java', 'class Client {}');
      expect(spec).toContain('is disabled due to lack of WASM support');
    });

    it('should handle unrecognised language ID', async () => {
      const spec = await service.generateOpenApi(dummyRepo, 'unknown-lang', '{}');
      expect(spec).toContain('is disabled due to lack of WASM support');
    });
  });
});
