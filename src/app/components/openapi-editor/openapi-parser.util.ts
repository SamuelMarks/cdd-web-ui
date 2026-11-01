/**
 * Multi-specification JSON/YAML parsing and structural validation utility
 * supporting OpenAPI 3.x (3.0/3.1/3.2.0), Swagger 2.0, Arazzo 1.x, and Google Discovery v1.
 * @module app/components/openapi-editor/openapi-parser.util
 */
import * as yaml from 'js-yaml';
import { SpecFormat, SpecValidationResult } from '../../models/types';

/**
 * Utility class for parsing and validating API specifications across OpenAPI 3.x,
 * Swagger 2.0, Arazzo 1.x, and Google Discovery v1.
 */
export class OpenApiParser {
  /**
   * Parses a string as JSON or YAML and validates its structure as OpenAPI 3.x,
   * Swagger 2.0, Arazzo 1.x, or Google Discovery v1.
   * @param content The raw specification string (JSON or YAML).
   * @returns A `SpecValidationResult` containing `isValid`, `parsed`, `errors`, `detectedFormat`, `version`, and `title`.
   */
  static parseAndValidate(content: string): SpecValidationResult {
    if (!content || content.trim() === '') {
      return {
        isValid: false,
        parsed: null,
        errors: ['Specification is empty.'],
        detectedFormat: null,
        version: null,
        title: null,
      };
    }

    let parsed: unknown;
    const errors: string[] = [];

    try {
      if (content.trim().startsWith('{')) {
        parsed = JSON.parse(content);
      } else {
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
      return {
        isValid: false,
        parsed: null,
        errors,
        detectedFormat: null,
        version: null,
        title: null,
      };
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      errors.push('Specification must be an object.');
      return {
        isValid: false,
        parsed: null,
        errors,
        detectedFormat: null,
        version: null,
        title: null,
      };
    }

    const spec = parsed as Record<string, unknown>;

    // 1. Check for Google Discovery Document v1
    if (spec['discoveryVersion'] !== undefined || spec['kind'] === 'discovery#restDescription') {
      const version =
        typeof spec['version'] === 'string'
          ? spec['version']
          : typeof spec['discoveryVersion'] === 'string'
            ? spec['discoveryVersion']
            : 'v1';
      const title =
        typeof spec['title'] === 'string'
          ? spec['title']
          : typeof spec['name'] === 'string'
            ? spec['name']
            : null;
      if (typeof spec['name'] !== 'string' || spec['name'].trim().length === 0) {
        errors.push('Missing "name" in Google Discovery document.');
      }
      if (typeof spec['version'] !== 'string' || spec['version'].trim().length === 0) {
        errors.push('Missing "version" in Google Discovery document.');
      }
      if (
        (!spec['resources'] || typeof spec['resources'] !== 'object') &&
        (!spec['methods'] || typeof spec['methods'] !== 'object') &&
        (!spec['schemas'] || typeof spec['schemas'] !== 'object')
      ) {
        errors.push('Google Discovery document must contain "resources", "methods", or "schemas".');
      }
      return {
        isValid: errors.length === 0,
        parsed,
        errors,
        detectedFormat: 'google_discovery',
        version,
        title,
      };
    }

    // 2. Check for Arazzo 1.x Workflow Specification
    if (spec['arazzo'] !== undefined) {
      const version = typeof spec['arazzo'] === 'string' ? spec['arazzo'] : '1.0.0';
      let title: string | null = null;
      if (!spec['info'] || typeof spec['info'] !== 'object') {
        errors.push('Missing or invalid "info" object.');
      } else {
        const info = spec['info'] as Record<string, unknown>;
        if (typeof info['title'] !== 'string' || info['title'].length === 0) {
          errors.push('Missing "info.title".');
        } else {
          title = info['title'];
        }
        if (!info['version']) {
          errors.push('Missing "info.version".');
        }
      }
      if (!Array.isArray(spec['sourceDescriptions']) || spec['sourceDescriptions'].length === 0) {
        errors.push('Missing or empty "sourceDescriptions" array in Arazzo specification.');
      }
      if (!Array.isArray(spec['workflows']) || spec['workflows'].length === 0) {
        errors.push('Missing or empty "workflows" array in Arazzo specification.');
      }
      return {
        isValid: errors.length === 0,
        parsed,
        errors,
        detectedFormat: 'arazzo',
        version,
        title,
      };
    }

    // 3. OpenAPI 3.x or Swagger 2.0 validation
    let detectedFormat: SpecFormat | null = null;
    let version: string | null = null;
    let title: string | null = null;

    if (typeof spec['openapi'] === 'string' && spec['openapi'].length > 0) {
      detectedFormat = 'openapi';
      version = spec['openapi'];
    } else if (typeof spec['swagger'] === 'string' && spec['swagger'].length > 0) {
      detectedFormat = 'swagger';
      version = spec['swagger'];
    } else {
      errors.push('Missing "openapi" or "swagger" version field.');
    }

    if (!spec['info'] || typeof spec['info'] !== 'object') {
      errors.push('Missing or invalid "info" object.');
    } else {
      const info = spec['info'] as Record<string, unknown>;
      if (typeof info['title'] !== 'string' || info['title'].length === 0) {
        errors.push('Missing "info.title".');
      } else {
        title = info['title'];
      }
      if (!info['version']) {
        errors.push('Missing "info.version".');
      }
    }

    const hasPaths = Boolean(spec['paths'] && typeof spec['paths'] === 'object');
    const hasWebhooks = Boolean(
      detectedFormat === 'openapi' && spec['webhooks'] && typeof spec['webhooks'] === 'object',
    );
    if (!hasPaths && !hasWebhooks) {
      errors.push('Missing or invalid "paths" object.');
    }

    return {
      isValid: errors.length === 0,
      parsed,
      errors,
      detectedFormat,
      version,
      title,
    };
  }
}
