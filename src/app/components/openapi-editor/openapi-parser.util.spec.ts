import { OpenApiParser } from './openapi-parser.util';
import { describe, it, expect, vi } from 'vitest';

describe('OpenApiParser', () => {
  it('should invalidate empty content', () => {
    const result = OpenApiParser.parseAndValidate('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Specification is empty.');
    expect(result.detectedFormat).toBeNull();
  });

  it('should parse and validate valid OpenAPI 3.x JSON (with paths or webhooks)', () => {
    const validJson = JSON.stringify({
      openapi: '3.2.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
    });
    const result = OpenApiParser.parseAndValidate(validJson);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.detectedFormat).toBe('openapi');
    expect(result.version).toBe('3.2.0');
    expect(result.title).toBe('Test');

    const webhooksOnly = JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Webhook Spec', version: '1.0' },
      webhooks: { newPet: {} },
    });
    const whResult = OpenApiParser.parseAndValidate(webhooksOnly);
    expect(whResult.isValid).toBe(true);
    expect(whResult.detectedFormat).toBe('openapi');
  });

  it('should parse and validate valid Swagger 2.0', () => {
    const swagger2 = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Legacy Petstore', version: '1.0.0' },
      paths: { '/pets': {} },
    });
    const result = OpenApiParser.parseAndValidate(swagger2);
    expect(result.isValid).toBe(true);
    expect(result.detectedFormat).toBe('swagger');
    expect(result.version).toBe('2.0');
    expect(result.title).toBe('Legacy Petstore');
  });

  it('should parse and validate Arazzo 1.x specifications and report structural errors', () => {
    const validArazzo = JSON.stringify({
      arazzo: '1.1.0',
      info: { title: 'Platform Lifecycle', version: '1.0.0' },
      sourceDescriptions: [{ name: 'api', url: './openapi.json', type: 'openapi' }],
      workflows: [{ workflowId: 'flow1', steps: [{ stepId: 's1', operationId: 'op1' }] }],
    });
    const res = OpenApiParser.parseAndValidate(validArazzo);
    expect(res.isValid).toBe(true);
    expect(res.detectedFormat).toBe('arazzo');
    expect(res.version).toBe('1.1.0');
    expect(res.title).toBe('Platform Lifecycle');

    const invalidArazzo1 = JSON.stringify({
      arazzo: 1,
      sourceDescriptions: [],
      workflows: [],
    });
    const errRes1 = OpenApiParser.parseAndValidate(invalidArazzo1);
    expect(errRes1.isValid).toBe(false);
    expect(errRes1.detectedFormat).toBe('arazzo');
    expect(errRes1.version).toBe('1.0.0');
    expect(errRes1.errors).toContain('Missing or invalid "info" object.');
    expect(errRes1.errors).toContain(
      'Missing or empty "sourceDescriptions" array in Arazzo specification.',
    );
    expect(errRes1.errors).toContain('Missing or empty "workflows" array in Arazzo specification.');

    const invalidArazzo2 = JSON.stringify({
      arazzo: '1.0.1',
      info: {},
      sourceDescriptions: [{ name: 'api', url: './openapi.json' }],
      workflows: [{ workflowId: 'flow1', steps: [] }],
    });
    const errRes2 = OpenApiParser.parseAndValidate(invalidArazzo2);
    expect(errRes2.isValid).toBe(false);
    expect(errRes2.errors).toContain('Missing "info.title".');
    expect(errRes2.errors).toContain('Missing "info.version".');
  });

  it('should parse and validate Google Discovery v1 documents and report structural errors', () => {
    const validDiscovery = JSON.stringify({
      discoveryVersion: 'v1',
      kind: 'discovery#restDescription',
      name: 'urlshortener',
      version: 'v1',
      title: 'URL Shortener API',
      resources: { url: {} },
    });
    const res = OpenApiParser.parseAndValidate(validDiscovery);
    expect(res.isValid).toBe(true);
    expect(res.detectedFormat).toBe('google_discovery');
    expect(res.version).toBe('v1');
    expect(res.title).toBe('URL Shortener API');

    // Discovery with methods or schemas instead of resources, and fallback title to name
    const methodsDiscovery = JSON.stringify({
      discoveryVersion: 'v1',
      name: 'customsearch',
      version: 'v1',
      methods: { list: {} },
    });
    const resMethods = OpenApiParser.parseAndValidate(methodsDiscovery);
    expect(resMethods.isValid).toBe(true);
    expect(resMethods.title).toBe('customsearch');

    const schemasDiscovery = JSON.stringify({
      kind: 'discovery#restDescription',
      name: 'compute',
      version: 'v1',
      schemas: { Instance: {} },
    });
    expect(OpenApiParser.parseAndValidate(schemasDiscovery).isValid).toBe(true);

    // Invalid Discovery missing name, version, and resources/methods/schemas
    const invalidDiscovery = JSON.stringify({
      kind: 'discovery#restDescription',
    });
    const errRes = OpenApiParser.parseAndValidate(invalidDiscovery);
    expect(errRes.isValid).toBe(false);
    expect(errRes.detectedFormat).toBe('google_discovery');
    expect(errRes.version).toBe('v1');
    expect(errRes.title).toBeNull();
    expect(errRes.errors).toContain('Missing "name" in Google Discovery document.');
    expect(errRes.errors).toContain('Missing "version" in Google Discovery document.');
    expect(errRes.errors).toContain(
      'Google Discovery document must contain "resources", "methods", or "schemas".',
    );

    // Discovery with discoveryVersion fallback when version is missing
    const discWithDiscVerOnly = JSON.stringify({
      discoveryVersion: 'v1',
      name: 'drive',
      resources: {},
    });
    expect(OpenApiParser.parseAndValidate(discWithDiscVerOnly).version).toBe('v1');
  });

  it('should parse and validate valid YAML', () => {
    const validYaml = `
openapi: 3.0.0
info:
  title: Test YAML
  version: "1.0"
paths: {}
`;
    const result = OpenApiParser.parseAndValidate(validYaml);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should catch invalid JSON/YAML parsing errors', () => {
    const invalidData = `[ ] invalid yaml syntax * &`;
    const result = OpenApiParser.parseAndValidate(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Parse error');
  });

  it('should handle non-Error objects with message property thrown during parsing', () => {
    const originalParse = globalThis.JSON.parse;
    globalThis.JSON.parse = vi.fn().mockImplementation(() => {
      throw { message: 'Custom thrown object error' } as unknown as Error;
    });

    const result = OpenApiParser.parseAndValidate('{ "invalid": true }');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Parse error: Custom thrown object error');

    globalThis.JSON.parse = originalParse;
  });

  it('should handle completely unknown errors thrown during parsing', () => {
    const originalParse = globalThis.JSON.parse;
    globalThis.JSON.parse = vi.fn().mockImplementation(() => {
      throw 'A string error' as unknown as Error;
    });

    const result = OpenApiParser.parseAndValidate('{ "invalid": true }');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Unknown parsing error.');

    globalThis.JSON.parse = originalParse;
  });

  it('should invalidate missing structural components', () => {
    const missingOpenApi = JSON.stringify({
      info: { title: 'Test', version: '1.0' },
      paths: {},
    });
    let result = OpenApiParser.parseAndValidate(missingOpenApi);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing "openapi" or "swagger" version field.');

    const missingInfo = JSON.stringify({
      openapi: '3.0.0',
      paths: {},
    });
    result = OpenApiParser.parseAndValidate(missingInfo);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing or invalid "info" object.');

    const invalidInfo = JSON.stringify({
      openapi: '3.0.0',
      info: 'a string',
      paths: {},
    });
    result = OpenApiParser.parseAndValidate(invalidInfo);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing or invalid "info" object.');

    const nullInfo = JSON.stringify({
      openapi: '3.0.0',
      info: null,
      paths: {},
    });
    result = OpenApiParser.parseAndValidate(nullInfo);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing or invalid "info" object.');

    const missingPaths = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
    });
    result = OpenApiParser.parseAndValidate(missingPaths);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing or invalid "paths" object.');
  });

  it('should catch missing properties inside info', () => {
    const missingTitle = JSON.stringify({
      openapi: '3.0.0',
      info: { version: '1.0' },
      paths: {},
    });
    let result = OpenApiParser.parseAndValidate(missingTitle);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing "info.title".');

    const missingVersion = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test' },
      paths: {},
    });
    result = OpenApiParser.parseAndValidate(missingVersion);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing "info.version".');
  });

  it('should catch non-object payloads', () => {
    const strPayload = `"just a string"`;
    const result = OpenApiParser.parseAndValidate(strPayload);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Specification must be an object.');
  });
});
