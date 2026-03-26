import { OpenApiParser } from './openapi-parser.util';
import { describe, it, expect } from 'vitest';

describe('OpenApiParser', () => {
  it('should invalidate empty content', () => {
    const result = OpenApiParser.parseAndValidate('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Specification is empty.');
  });

  it('should parse and validate valid JSON', () => {
    const validJson = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
    });
    const result = OpenApiParser.parseAndValidate(validJson);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.parsed).toHaveProperty('openapi', '3.0.0');
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
    // js-yaml throws on this
    const result = OpenApiParser.parseAndValidate(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Parse error');
  });

  it('should handle non-Error objects with message property thrown during parsing', () => {
    const originalParse = globalThis.JSON.parse;
    globalThis.JSON.parse = vi.fn().mockImplementation(() => {
      throw { message: 'Custom thrown object error' };
    });

    const result = OpenApiParser.parseAndValidate('{ "invalid": true }');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Parse error: Custom thrown object error');

    globalThis.JSON.parse = originalParse;
  });

  it('should handle completely unknown errors thrown during parsing', () => {
    const originalParse = globalThis.JSON.parse;
    globalThis.JSON.parse = vi.fn().mockImplementation(() => {
      throw 'A string error';
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
