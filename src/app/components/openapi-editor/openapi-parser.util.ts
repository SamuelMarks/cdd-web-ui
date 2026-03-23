import * as yaml from 'js-yaml';

/**
 * Utility class for parsing and validating OpenAPI specifications.
 */
export class OpenApiParser {
  /**
   * Parses a string as JSON or YAML and validates its basic structure.
   * @param content The OpenAPI specification string.
   * @returns An object containing `isValid`, the `parsed` object (if valid), and an array of `errors`.
   */
  static parseAndValidate(content: string): { isValid: boolean; parsed: unknown | null; errors: string[] } {
    if (!content || content.trim() === '') {
      return { isValid: false, parsed: null, errors: ['Specification is empty.'] };
    }

    let parsed: unknown = null;
    const errors: string[] = [];

    try {
      // Try parsing as JSON first
      if (content.trim().startsWith('{')) {
         parsed = JSON.parse(content);
      } else {
         // Fallback to YAML
         parsed = yaml.load(content);
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
         errors.push(`Parse error: ${e.message}`);
      } else if (e && typeof e === 'object' && 'message' in e) {
         errors.push(`Parse error: ${(e as Error).message}`);
      } else {
         errors.push('Unknown parsing error.');
      }
      return { isValid: false, parsed: null, errors };
    }
    
    // JS-YAML can successfully parse plain strings, which is technically valid yaml but not openapi
    if (typeof parsed !== 'object' || parsed === null) {
       errors.push('Specification must be an object.');
       return { isValid: false, parsed: null, errors };
    }
    
    // A string containing just "openapi: 3.0.0" and "info: {title: missing quote}" is parsed by yaml
    // as `{ openapi: '3.0.0', info: '{title: missing quote}' }` (info becomes a string).
    
    // Basic OpenAPI structural validation
    const spec = parsed as Record<string, unknown>;
    
    if (!spec['openapi'] && !spec['swagger']) {
      errors.push('Missing "openapi" or "swagger" version field.');
    }
    
    /* istanbul ignore next */ if (!spec['info'] || typeof spec['info'] !== 'object') {
      errors.push('Missing or invalid "info" object.');
    } else {
       const info = spec['info'] as Record<string, unknown>;
       if (!info['title']) errors.push('Missing "info.title".');
       if (!info['version']) errors.push('Missing "info.version".');
    }

    if (!spec['paths'] || typeof spec['paths'] !== 'object') {
       errors.push('Missing or invalid "paths" object.');
    }

    return {
      isValid: errors.length === 0,
      parsed,
      errors
    };
  }
}
