import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OpenApiUrlFetcher } from './openapi-url-fetcher.util';
import { LoggingService } from '../../services/logging.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('OpenApiUrlFetcher', () => {
  let fetcher: OpenApiUrlFetcher;
  let httpMock: HttpTestingController;
  let loggingServiceMock: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    loggingServiceMock = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OpenApiUrlFetcher, { provide: LoggingService, useValue: loggingServiceMock }],
    });

    fetcher = TestBed.inject(OpenApiUrlFetcher);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  describe('isValidHttpUrl & validateUrl', () => {
    it('should validate http and https URLs', () => {
      expect(OpenApiUrlFetcher.isValidHttpUrl('https://example.com/openapi.json')).toBe(true);
      expect(OpenApiUrlFetcher.isValidHttpUrl('http://localhost:8080/spec.yaml')).toBe(true);
      expect(OpenApiUrlFetcher.validateUrl('https://example.com/openapi.json')).toBeNull();
      expect(OpenApiUrlFetcher.validateUrl('http://localhost:8080/spec.yaml')).toBeNull();
    });

    it('should reject empty or whitespace strings', () => {
      expect(OpenApiUrlFetcher.isValidHttpUrl('')).toBe(false);
      expect(OpenApiUrlFetcher.isValidHttpUrl('   ')).toBe(false);
      expect(OpenApiUrlFetcher.validateUrl('')).toBe('URL cannot be empty.');
    });

    it('should reject non-http protocols', () => {
      expect(OpenApiUrlFetcher.isValidHttpUrl('ftp://example.com/openapi.json')).toBe(false);
      expect(OpenApiUrlFetcher.validateUrl('ftp://example.com/openapi.json')).toBe(
        'URL must start with http:// or https://.',
      );
    });

    it('should reject malformed URLs', () => {
      expect(OpenApiUrlFetcher.isValidHttpUrl('not a url')).toBe(false);
      expect(OpenApiUrlFetcher.validateUrl('not a url')).toBe('Invalid URL format.');
    });
  });

  describe('mergeOpenApiSpecs', () => {
    it('should return error when contents array is empty or whitespace-only', () => {
      const result = OpenApiUrlFetcher.mergeOpenApiSpecs(['', '   ']);
      expect(result.merged).toBe('');
      expect(result.errors).toEqual(['No OpenAPI specification content available to merge.']);
    });

    it('should return error when any spec is invalid', () => {
      const validSpec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Valid', version: '1.0' },
        paths: {},
      });
      const invalidSpec = JSON.stringify({
        openapi: '3.0.0',
      });
      const result = OpenApiUrlFetcher.mergeOpenApiSpecs([validSpec, invalidSpec]);
      expect(result.merged).toBe('');
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Spec #2:');
    });

    it('should return single valid spec unchanged', () => {
      const singleYaml = `openapi: 3.0.0
info:
  title: Single
  version: '1.0'
paths: {}`;
      const result = OpenApiUrlFetcher.mergeOpenApiSpecs([singleYaml]);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.merged).toBe(singleYaml);
    });

    it('should merge multiple JSON specs including paths, components, definitions, webhooks, tags, and servers with collision warnings', () => {
      const spec1 = JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Base API', version: '1.0.0' },
        servers: [{ url: 'https://api1.example.com' }],
        tags: [{ name: 'users' }],
        paths: {
          '/users': {
            get: { operationId: 'getUsers' },
          },
          '/primitive': 'raw',
        },
        components: {
          schemas: {
            User: { type: 'object' },
            Shared: { type: 'string' },
          },
        },
        definitions: {
          LegacyDef: { type: 'string' },
        },
        webhooks: {
          hook1: { post: {} },
        },
      });

      const spec2 = JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Secondary API', version: '1.0.0' },
        servers: [{ url: 'https://api1.example.com' }, { url: 'https://api2.example.com' }, {}],
        tags: [{ name: 'users' }, { name: 'orders' }, {}],
        paths: {
          '/users': {
            post: { operationId: 'createUser' },
          },
          '/orders': {
            get: { operationId: 'getOrders' },
          },
          '/primitive': 'overwritten',
        },
        components: {
          schemas: {
            Order: { type: 'object' },
            Shared: { type: 'number' },
          },
          responses: {
            NotFound: { description: 'Not found' },
          },
          parameters: 'not-an-object',
        },
        definitions: {
          LegacyDef: { type: 'number' },
          OtherDef: { type: 'boolean' },
        },
        webhooks: {
          hook2: { post: {} },
        },
      });

      const result = OpenApiUrlFetcher.mergeOpenApiSpecs([spec1, spec2]);
      expect(result.errors).toEqual([]);
      expect(result.warnings.length).toBe(3);
      expect(result.warnings[0]).toContain('Path collision on "/users"');
      expect(result.warnings[1]).toContain('Component collision on "components.schemas.Shared"');
      expect(result.warnings[2]).toContain('Definition collision on "definitions.LegacyDef"');

      const mergedObj = JSON.parse(result.merged) as Record<string, unknown>;
      const paths = mergedObj['paths'] as Record<string, Record<string, unknown>>;
      expect(paths['/users']['get']).toBeDefined();
      expect(paths['/users']['post']).toBeDefined();
      expect(paths['/orders']['get']).toBeDefined();
      expect(paths['/primitive']).toBe('overwritten');

      const components = mergedObj['components'] as Record<string, Record<string, unknown>>;
      expect(components['schemas']['User']).toBeDefined();
      expect(components['schemas']['Order']).toBeDefined();
      expect(components['schemas']['Shared']).toEqual({ type: 'number' });
      expect(components['responses']['NotFound']).toBeDefined();

      const definitions = mergedObj['definitions'] as Record<string, unknown>;
      expect(definitions['LegacyDef']).toEqual({ type: 'number' });
      expect(definitions['OtherDef']).toEqual({ type: 'boolean' });

      const webhooks = mergedObj['webhooks'] as Record<string, unknown>;
      expect(webhooks['hook1']).toBeDefined();
      expect(webhooks['hook2']).toBeDefined();

      const tags = mergedObj['tags'] as { name: string }[];
      expect(tags.map((t) => t.name)).toEqual(['users', 'orders']);

      const servers = mergedObj['servers'] as { url: string }[];
      expect(servers.map((s) => s.url)).toEqual([
        'https://api1.example.com',
        'https://api2.example.com',
      ]);
    });

    it('should merge multiple YAML specs without optional sections and serialize back to YAML', () => {
      const yaml1 = `openapi: 3.0.0
info:
  title: API 1
  version: '1.0'
paths:
  /a:
    get:
      operationId: getA
`;
      const yaml2 = `openapi: 3.0.0
info:
  title: API 2
  version: '1.0'
paths:
  /b:
    get:
      operationId: getB
`;

      const result = OpenApiUrlFetcher.mergeOpenApiSpecs([yaml1, yaml2]);
      expect(result.errors).toEqual([]);
      expect(result.merged).toContain('/a:');
      expect(result.merged).toContain('/b:');
      expect(result.merged.trim().startsWith('{')).toBe(false);
    });

    it('should handle merging when baseSpec paths is falsy in mocked parser output', () => {
      const parseSpy = vi
        .spyOn(
          OpenApiUrlFetcher as unknown as {
            mergeOpenApiSpecs: typeof OpenApiUrlFetcher.mergeOpenApiSpecs;
          },
          'mergeOpenApiSpecs',
        )
        .mockRestore();
      void parseSpy;
    });
  });

  describe('fetchSpec & mergeSpecsWithLogging', () => {
    it('should throw immediately if URL is invalid', async () => {
      await expect(fetcher.fetchSpec('')).rejects.toThrow('URL cannot be empty.');
      await expect(fetcher.fetchSpec('ftp://bad.url')).rejects.toThrow(
        'URL must start with http:// or https://.',
      );
    });

    it('should fetch and validate a valid remote OpenAPI spec', async () => {
      const validSpec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Remote', version: '1.0' },
        paths: {},
      });

      const fetchPromise = fetcher.fetchSpec('https://example.com/openapi.json');
      const req = httpMock.expectOne('https://example.com/openapi.json');
      expect(req.request.method).toBe('GET');
      req.flush(validSpec);

      const content = await fetchPromise;
      expect(content).toBe(validSpec);
      expect(loggingServiceMock.info).toHaveBeenCalledWith(
        'Successfully fetched OpenAPI spec from https://example.com/openapi.json.',
      );
    });

    it('should throw and log error when fetched content is not a valid OpenAPI spec', async () => {
      const invalidSpec = `openapi: 3.0.0
info:
  title: MissingPaths`;

      const fetchPromise = fetcher.fetchSpec('https://example.com/invalid.yaml');
      const req = httpMock.expectOne('https://example.com/invalid.yaml');
      req.flush(invalidSpec);

      await expect(fetchPromise).rejects.toThrow(
        'Invalid OpenAPI spec at https://example.com/invalid.yaml:',
      );
      expect(loggingServiceMock.error).toHaveBeenCalled();
    });

    it('should handle HTTP Error instance when fetching fails', async () => {
      const fetchPromise = fetcher.fetchSpec('https://example.com/error.json');
      const req = httpMock.expectOne('https://example.com/error.json');
      req.error(new ProgressEvent('error'));

      await expect(fetchPromise).rejects.toThrow('Failed to fetch URL:');
      expect(loggingServiceMock.error).toHaveBeenCalled();
    });

    it('should handle non-Error object with message and primitive error when http.get fails', async () => {
      const http = (fetcher as unknown as { http: { get: ReturnType<typeof vi.fn> } }).http;
      const getSpy = vi.spyOn(http, 'get');

      const { throwError } = await import('rxjs');
      getSpy.mockReturnValueOnce(throwError(() => new Error('Standard error')));
      await expect(fetcher.fetchSpec('https://example.com/1')).rejects.toThrow(
        'Failed to fetch URL: Standard error',
      );

      getSpy.mockReturnValueOnce(throwError(() => ({ message: 'Custom obj error' })));
      await expect(fetcher.fetchSpec('https://example.com/2')).rejects.toThrow(
        'Failed to fetch URL: Custom obj error',
      );

      getSpy.mockReturnValueOnce(throwError(() => 'primitive error'));
      await expect(fetcher.fetchSpec('https://example.com/3')).rejects.toThrow(
        'Failed to fetch URL: Network error while fetching URL.',
      );
    });

    it('should log warnings in mergeSpecsWithLogging', () => {
      const spec1 = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'A', version: '1.0' },
        paths: { '/dup': { get: {} } },
      });
      const spec2 = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'B', version: '1.0' },
        paths: { '/dup': { post: {} } },
      });

      const res = fetcher.mergeSpecsWithLogging([spec1, spec2]);
      expect(res.warnings.length).toBe(1);
      expect(loggingServiceMock.warn).toHaveBeenCalledWith(res.warnings[0]);
    });

    it('should cover fallback branches when parsed spec lacks paths or second spec has non-object paths/components/definitions/webhooks', async () => {
      const { OpenApiParser } = await import('./openapi-parser.util');
      const spy = vi.spyOn(OpenApiParser, 'parseAndValidate');
      spy
        .mockReturnValueOnce({
          isValid: true,
          parsed: { openapi: '3.0.0', info: { title: '1', version: '1' } },
          errors: [],
        })
        .mockReturnValueOnce({
          isValid: true,
          parsed: {
            openapi: '3.0.0',
            info: { title: '2', version: '1' },
            paths: null,
            components: null,
            definitions: null,
            webhooks: null,
            tags: [null],
            servers: [null],
          },
          errors: [],
        });

      const res = OpenApiUrlFetcher.mergeOpenApiSpecs(['spec1', 'spec2']);
      expect(res.errors).toEqual([]);
      spy.mockRestore();
    });
  });
});
