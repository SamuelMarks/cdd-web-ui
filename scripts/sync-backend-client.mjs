#!/usr/bin/env node
/**
 * @file Synchronizes `cdd-web-ui` Angular client models and services with the
 * canonical backend OpenAPI 3.2.0 and Arazzo 1.1.0 contracts using `../cdd-ts`
 * configured for Angular `HttpClient` (`framework: 'angular'`, `implementation: 'angular'`,
 * `platform: 'browser'`).
 * @module scripts/sync-backend-client
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractBackendOpenApi } from './extract-backend-openapi.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONTRACTS_DIR = path.join(ROOT, 'contracts');
const CDD_TS_INDEX = path.resolve(ROOT, '../cdd-ts/dist/index.js');

/**
 * Canonical `FromOpenApiOptions` parameters for generating an Angular `HttpClient` SDK via `../cdd-ts`.
 * @param {string} inputPath Path to the OpenAPI 3.2.0 specification.
 * @param {string} outputDir Target directory for generated Angular SDK files.
 * @returns {Record<string, unknown>} `FromOpenApiOptions` object for `generateFromOpenApi(options, 'to_sdk')`.
 */
export function buildAngularHttpClientOptions(inputPath, outputDir) {
  return {
    input: inputPath,
    output: outputDir,
    clientName: 'cddBackend',
    framework: 'angular',
    implementation: 'angular',
    platform: 'browser',
    dateType: 'string',
    enumStyle: 'union',
    int64Type: 'number',
    generateServices: true,
    admin: false,
    testGen: false,
    testsForService: false,
    testsForAdmin: false,
    githubActions: false,
    installablePackage: false,
  };
}

/**
 * Synchronizes backend OpenAPI contracts and validates Angular `HttpClient` SDK generation via `../cdd-ts`.
 */
export async function syncBackendClient() {
  extractBackendOpenApi();

  const backendSpecPath = path.join(CONTRACTS_DIR, 'cdd-backend.openapi.json');
  const arazzoSpecPath = path.join(CONTRACTS_DIR, 'cdd-platform.arazzo.json');

  if (!fs.existsSync(CDD_TS_INDEX)) {
    console.log('Note: ../cdd-ts/dist/index.js not found; contract files extracted to contracts/.');
    return;
  }

  const cddTs = await import(pathToFileURL(CDD_TS_INDEX).href);

  // 1. Validate the Arazzo 1.1.0 platform lifecycle workflow specification using cdd-ts
  const arazzoRaw = JSON.parse(fs.readFileSync(arazzoSpecPath, 'utf8'));
  const arazzoErrors = cddTs.validateArazzoSpec(arazzoRaw);
  if (Array.isArray(arazzoErrors) && arazzoErrors.length > 0) {
    throw new Error(`Arazzo validation failed in cdd-ts: ${arazzoErrors.join('; ')}`);
  }
  console.log('Validated contracts/cdd-platform.arazzo.json via ../cdd-ts validateArazzoSpec.');

  // 2. Generate Angular HttpClient SDK from contracts/cdd-backend.openapi.json using cdd-ts
  const tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdd-web-ui-sdk-sync-'));
  try {
    await cddTs.generateFromOpenApi(
      buildAngularHttpClientOptions(backendSpecPath, tmpOutDir),
      'to_sdk',
    );
    const servicesDir = path.join(tmpOutDir, 'services');
    const serviceFiles = fs.existsSync(servicesDir)
      ? fs.readdirSync(servicesDir).filter((f) => f.endsWith('.service.ts'))
      : [];
    if (serviceFiles.length === 0) {
      throw new Error('cdd-ts generateFromOpenApi produced no Angular *.service.ts files.');
    }
    for (const sf of serviceFiles) {
      const content = fs.readFileSync(path.join(servicesDir, sf), 'utf8');
      if (!content.includes('@angular/common/http') || !content.includes('inject(HttpClient)')) {
        throw new Error(
          `Generated Angular service ${sf} does not use Angular HttpClient via inject(HttpClient).`,
        );
      }
    }
    console.log(
      `Verified ../cdd-ts Angular HttpClient SDK generation from contracts/cdd-backend.openapi.json (${serviceFiles.length} Angular HttpClient services).`,
    );
  } finally {
    fs.rmSync(tmpOutDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await syncBackendClient();
}
