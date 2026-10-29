/**
 * Remote OpenAPI specification URL validation, fetching, and merging service.
 * @module app/components/openapi-editor/openapi-url-fetcher.util
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as yaml from 'js-yaml';
import { OpenApiParser } from './openapi-parser.util';
import { LoggingService } from '../../services/logging.service';

/**
 * Result of merging one or more OpenAPI specifications.
 */
export interface OpenApiMergeResult {
  /** The merged OpenAPI specification string (YAML or JSON). */
  merged: string;
  /** Any validation or parsing errors encountered during merging. */
  errors: string[];
  /** Non-fatal warnings (e.g. path or schema collisions). */
  warnings: string[];
}

/**
 * Utility and service for validating, fetching, and merging remote OpenAPI specifications.
 */
@Injectable({
  providedIn: 'root',
})
export class OpenApiUrlFetcher {
  /** Injected Angular HttpClient for remote specification retrieval. */
  private http = inject(HttpClient);
  /** Injected LoggingService for recording merge warnings and fetch activity. */
  private loggingService = inject(LoggingService);

  /**
   * Validates whether a given string is a well-formed HTTP or HTTPS URL.
   * @param url The URL string to validate.
   * @returns True if the URL is valid and uses http: or https:, false otherwise.
   */
  static isValidHttpUrl(url: string): boolean {
    const trimmed = url.trim();
    if (!trimmed) {
      return false;
    }
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Validates a URL string and returns a human-readable error message if invalid.
   * @param url The URL string to validate.
   * @returns Null if valid, or a descriptive error message string.
   */
  static validateUrl(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) {
      return 'URL cannot be empty.';
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'URL must start with http:// or https://.';
      }
      return null;
    } catch {
      return 'Invalid URL format.';
    }
  }

  /**
   * Merges one or more raw OpenAPI specification strings (JSON or YAML) into a single specification.
   * @param contents Array of raw OpenAPI specification strings.
   * @returns An OpenApiMergeResult containing the merged content, errors, and warnings.
   */
  static mergeOpenApiSpecs(contents: string[]): OpenApiMergeResult {
    const nonEmpty = contents.map((c) => c.trim()).filter((c) => c.length > 0);
    if (nonEmpty.length === 0) {
      return {
        merged: '',
        errors: ['No OpenAPI specification content available to merge.'],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const parsedSpecs: Record<string, unknown>[] = [];

    for (let i = 0; i < nonEmpty.length; i++) {
      const raw = nonEmpty[i];
      const validation = OpenApiParser.parseAndValidate(raw);
      if (!validation.isValid || !validation.parsed || typeof validation.parsed !== 'object') {
        const reason = validation.errors.join(' ');
        errors.push(`Spec #${i + 1}: ${reason}`);
      } else {
        parsedSpecs.push(validation.parsed as Record<string, unknown>);
      }
    }

    if (errors.length > 0) {
      return {
        merged: '',
        errors,
        warnings,
      };
    }

    if (nonEmpty.length === 1) {
      return {
        merged: nonEmpty[0],
        errors: [],
        warnings: [],
      };
    }

    const baseSpec = JSON.parse(JSON.stringify(parsedSpecs[0])) as Record<string, unknown>;
    const mergedPaths: Record<string, unknown> =
      baseSpec['paths'] && typeof baseSpec['paths'] === 'object'
        ? { ...(baseSpec['paths'] as Record<string, unknown>) }
        : {};
    const baseComponents: Record<string, unknown> =
      baseSpec['components'] && typeof baseSpec['components'] === 'object'
        ? { ...(baseSpec['components'] as Record<string, unknown>) }
        : {};
    const mergedDefinitions: Record<string, unknown> =
      baseSpec['definitions'] && typeof baseSpec['definitions'] === 'object'
        ? { ...(baseSpec['definitions'] as Record<string, unknown>) }
        : {};
    const mergedWebhooks: Record<string, unknown> =
      baseSpec['webhooks'] && typeof baseSpec['webhooks'] === 'object'
        ? { ...(baseSpec['webhooks'] as Record<string, unknown>) }
        : {};

    const mergedTags: Record<string, unknown>[] = Array.isArray(baseSpec['tags'])
      ? [...(baseSpec['tags'] as Record<string, unknown>[])]
      : [];
    const mergedServers: Record<string, unknown>[] = Array.isArray(baseSpec['servers'])
      ? [...(baseSpec['servers'] as Record<string, unknown>[])]
      : [];

    const componentSections = [
      'schemas',
      'responses',
      'parameters',
      'examples',
      'requestBodies',
      'headers',
      'securitySchemes',
      'links',
      'callbacks',
      'pathItems',
    ];

    for (let i = 1; i < parsedSpecs.length; i++) {
      const current = parsedSpecs[i];

      if (current['paths'] && typeof current['paths'] === 'object') {
        const pathsObj = current['paths'] as Record<string, unknown>;
        for (const [pathKey, pathVal] of Object.entries(pathsObj)) {
          if (
            pathKey in mergedPaths &&
            typeof mergedPaths[pathKey] === 'object' &&
            mergedPaths[pathKey] !== null &&
            typeof pathVal === 'object' &&
            pathVal !== null
          ) {
            warnings.push(`Path collision on "${pathKey}" in Spec #${i + 1}; merging operations.`);
            mergedPaths[pathKey] = {
              ...(mergedPaths[pathKey] as Record<string, unknown>),
              ...(pathVal as Record<string, unknown>),
            };
          } else {
            mergedPaths[pathKey] = pathVal;
          }
        }
      }

      if (current['components'] && typeof current['components'] === 'object') {
        const compObj = current['components'] as Record<string, unknown>;
        for (const section of componentSections) {
          if (compObj[section] && typeof compObj[section] === 'object') {
            const existingSection =
              baseComponents[section] && typeof baseComponents[section] === 'object'
                ? { ...(baseComponents[section] as Record<string, unknown>) }
                : {};
            const incomingSection = compObj[section] as Record<string, unknown>;
            for (const [itemKey, itemVal] of Object.entries(incomingSection)) {
              if (itemKey in existingSection) {
                warnings.push(
                  `Component collision on "components.${section}.${itemKey}" in Spec #${i + 1}; overriding with latest.`,
                );
              }
              existingSection[itemKey] = itemVal;
            }
            baseComponents[section] = existingSection;
          }
        }
      }

      if (current['definitions'] && typeof current['definitions'] === 'object') {
        const defsObj = current['definitions'] as Record<string, unknown>;
        for (const [defKey, defVal] of Object.entries(defsObj)) {
          if (defKey in mergedDefinitions) {
            warnings.push(
              `Definition collision on "definitions.${defKey}" in Spec #${i + 1}; overriding with latest.`,
            );
          }
          mergedDefinitions[defKey] = defVal;
        }
      }

      if (current['webhooks'] && typeof current['webhooks'] === 'object') {
        const webhooksObj = current['webhooks'] as Record<string, unknown>;
        for (const [hookKey, hookVal] of Object.entries(webhooksObj)) {
          mergedWebhooks[hookKey] = hookVal;
        }
      }

      if (Array.isArray(current['tags'])) {
        for (const tag of current['tags'] as Record<string, unknown>[]) {
          const tagName = tag?.['name'];
          if (tagName && !mergedTags.some((t) => t['name'] === tagName)) {
            mergedTags.push(tag);
          }
        }
      }

      if (Array.isArray(current['servers'])) {
        for (const srv of current['servers'] as Record<string, unknown>[]) {
          const srvUrl = srv?.['url'];
          if (srvUrl && !mergedServers.some((s) => s['url'] === srvUrl)) {
            mergedServers.push(srv);
          }
        }
      }
    }

    baseSpec['paths'] = mergedPaths;
    if (Object.keys(baseComponents).length > 0) {
      baseSpec['components'] = baseComponents;
    }
    if (Object.keys(mergedDefinitions).length > 0) {
      baseSpec['definitions'] = mergedDefinitions;
    }
    if (Object.keys(mergedWebhooks).length > 0) {
      baseSpec['webhooks'] = mergedWebhooks;
    }
    if (mergedTags.length > 0) {
      baseSpec['tags'] = mergedTags;
    }
    if (mergedServers.length > 0) {
      baseSpec['servers'] = mergedServers;
    }

    const preferJson = nonEmpty[0].startsWith('{');
    const serialized = preferJson
      ? JSON.stringify(baseSpec, null, 2)
      : yaml.dump(baseSpec, { indent: 2, lineWidth: -1 });

    return {
      merged: serialized,
      errors: [],
      warnings,
    };
  }

  /**
   * Fetches a single OpenAPI specification from a remote URL and validates its content.
   * @param url The remote URL to fetch.
   * @returns A promise resolving to the validated raw specification string.
   */
  async fetchSpec(url: string): Promise<string> {
    const urlError = OpenApiUrlFetcher.validateUrl(url);
    if (urlError) {
      throw new Error(urlError);
    }

    const trimmedUrl = url.trim();
    this.loggingService.info(`Fetching OpenAPI spec from ${trimmedUrl}...`);

    let responseText: string;
    try {
      responseText = await firstValueFrom(
        this.http.get(trimmedUrl, {
          responseType: 'text',
        }),
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === 'object' && 'message' in err
            ? String(err.message)
            : 'Network error while fetching URL.';
      this.loggingService.error(`Failed to fetch ${trimmedUrl}: ${message}`);
      throw new Error(`Failed to fetch URL: ${message}`, { cause: err });
    }

    const validation = OpenApiParser.parseAndValidate(responseText);
    if (!validation.isValid) {
      const errorMsg = `Invalid OpenAPI spec at ${trimmedUrl}: ${validation.errors.join(' ')}`;
      this.loggingService.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.loggingService.info(`Successfully fetched OpenAPI spec from ${trimmedUrl}.`);
    return responseText;
  }

  /**
   * Merges multiple fetched specification strings and logs any collision warnings.
   * @param contents Array of fetched OpenAPI specification strings.
   * @returns The OpenApiMergeResult.
   */
  mergeSpecsWithLogging(contents: string[]): OpenApiMergeResult {
    const result = OpenApiUrlFetcher.mergeOpenApiSpecs(contents);
    for (const warning of result.warnings) {
      this.loggingService.warn(warning);
    }
    return result;
  }
}
