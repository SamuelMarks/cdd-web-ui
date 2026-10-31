#!/usr/bin/env node
/**
 * @file Verifies 100% contract conformance and alignment between `cdd-web-ui`,
 * `contracts/*.json`, `../cdd-ops` sibling backend microservices (`cdd-gateway`,
 * `cdd-control-plane`, `cdd-engine`, `cdd-storage`, `cdd-publisher`), and `../cdd-ts`
 * Angular `HttpClient` SDK generation (`framework: 'angular'`, `implementation: 'angular'`,
 * `platform: 'browser'`).
 * @module scripts/check-backend-conformance
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { buildAngularHttpClientOptions } from './sync-backend-client.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONTRACTS_DIR = path.join(ROOT, 'contracts');
const CDD_TS_INDEX = path.resolve(ROOT, '../cdd-ts/dist/index.js');

/**
 * Parses a TypeScript file and extracts all class method names and exported interface/type declarations.
 * @param {string} filePath Absolute path to the TypeScript file.
 * @returns {{ methods: Set<string>, types: Map<string, Set<string>> }} Extracted methods and types.
 */
function parseTsDefinitions(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.ES2022, true);
  const methods = new Set();
  const types = new Map();

  /**
   * Visits AST nodes recursively.
   * @param {ts.Node} node Current AST node.
   */
  function visit(node) {
    if (ts.isClassDeclaration(node)) {
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name) {
          methods.add(member.name.getText(sourceFile));
        }
      }
    } else if (ts.isInterfaceDeclaration(node) && node.name) {
      const props = new Set();
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) {
          props.add(member.name.getText(sourceFile));
        }
      }
      types.set(node.name.text, props);
    } else if (ts.isTypeAliasDeclaration(node) && node.name) {
      types.set(node.name.text, new Set());
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return { methods, types };
}

/**
 * Verifies contract conformance across `contracts/`, `src/app/`, `../cdd-ops`, and `../cdd-ts`.
 */
export async function checkBackendConformance() {
  const errors = [];

  const requiredContracts = [
    'cdd-gateway.openapi.json',
    'cdd-control-plane.openapi.json',
    'cdd-storage.openapi.json',
    'cdd-backend.openapi.json',
    'cdd-platform.arazzo.json',
  ];

  for (const filename of requiredContracts) {
    const fullPath = path.join(CONTRACTS_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing contract file: contracts/${filename}`);
    }
  }

  if (errors.length > 0) {
    console.error('Backend conformance check failed:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  const backendSpecPath = path.join(CONTRACTS_DIR, 'cdd-backend.openapi.json');
  const unifiedSpec = JSON.parse(fs.readFileSync(backendSpecPath, 'utf8'));

  // Collect all methods and types from Angular client services and models
  const serviceFiles = [
    path.join(ROOT, 'src/app/services/api.service.ts'),
    path.join(ROOT, 'src/app/services/artifact-storage.service.ts'),
    path.join(ROOT, 'src/app/services/mcp-rpc.service.ts'),
  ];
  const modelFiles = [
    path.join(ROOT, 'src/app/models/types.ts'),
    path.join(ROOT, 'src/app/services/api.service.ts'),
  ];

  const allServiceMethods = new Set();
  for (const sf of serviceFiles) {
    const { methods } = parseTsDefinitions(sf);
    for (const m of methods) {
      allServiceMethods.add(m);
    }
  }

  const allClientTypes = new Map();
  for (const mf of modelFiles) {
    const { types } = parseTsDefinitions(mf);
    for (const [typeName, props] of types.entries()) {
      const existing = allClientTypes.get(typeName) || new Set();
      for (const p of props) {
        existing.add(p);
      }
      allClientTypes.set(typeName, existing);
    }
  }

  // 1. Verify every operationId in cdd-backend.openapi.json is implemented by an Angular service method
  let checkedOperations = 0;
  const expectedOperationIds = [];
  for (const [routePath, pathItem] of Object.entries(unifiedSpec.paths || {})) {
    for (const [httpMethod, operation] of Object.entries(pathItem)) {
      const opId = operation.operationId;
      if (!opId) {
        errors.push(`${httpMethod.toUpperCase()} ${routePath} is missing operationId`);
        continue;
      }
      checkedOperations++;
      expectedOperationIds.push(opId);
      if (!allServiceMethods.has(opId)) {
        errors.push(
          `Backend operation '${opId}' (${httpMethod.toUpperCase()} ${routePath}) is missing in Angular services`,
        );
      }
    }
  }

  // 2. Verify every schema in components.schemas is defined in TypeScript models with required fields
  let checkedSchemas = 0;
  for (const [schemaName, schemaDef] of Object.entries(unifiedSpec.components?.schemas || {})) {
    checkedSchemas++;
    if (!allClientTypes.has(schemaName)) {
      errors.push(`Backend schema '${schemaName}' is missing in TypeScript client models`);
      continue;
    }
    const tsProps = allClientTypes.get(schemaName);
    if (schemaDef.type === 'object' && Array.isArray(schemaDef.required) && tsProps.size > 0) {
      for (const reqProp of schemaDef.required) {
        if (!tsProps.has(reqProp)) {
          errors.push(
            `TypeScript interface '${schemaName}' is missing required backend property '${reqProp}'`,
          );
        }
      }
    }
  }

  // 3. Verify sibling backend repositories when present on disk
  const siblingChecks = [
    {
      repo: '../cdd-gateway',
      file: 'src/api/mod.rs',
      markers: [
        '/health',
        '/version',
        'auth::configure',
        'orgs::configure',
        'repos::configure',
        'github::configure',
        'rpc::configure',
      ],
    },
    {
      repo: '../cdd-control-plane',
      file: 'src/api/mod.rs',
      markers: [
        '/api/v1',
        'auth::configure',
        'orgs::configure',
        'repos::configure',
        'tokens::configure',
        'audit::configure',
      ],
    },
    {
      repo: '../cdd-storage',
      file: 'src/lib.rs',
      markers: [
        '/health',
        '/upload/{org_id}/{repo_id}/{version}',
        '/artifact/{org_id}/{repo_id}/{file_path:.*}',
      ],
    },
    {
      repo: '../cdd-engine',
      file: 'src/mcp.rs',
      markers: ['2024-11-05', 'cdd_generate_sdk', 'tools/list', 'tools/call'],
    },
    {
      repo: '../cdd-publisher',
      file: 'src/audit.rs',
      markers: ['/api/v1/audit/publish', 'artifact_id', 'registry', 'success', 'error_message'],
    },
    {
      repo: '../cdd-ops',
      file: 'libscript.json',
      markers: [
        'cdd-gateway',
        'cdd-control-plane',
        'cdd-engine',
        'cdd-storage',
        'cdd-publisher',
        'cdd-web-ui',
        'cdd-docs-ui',
      ],
    },
  ];

  for (const check of siblingChecks) {
    const targetFile = path.resolve(ROOT, check.repo, check.file);
    if (fs.existsSync(targetFile)) {
      const content = fs.readFileSync(targetFile, 'utf8');
      for (const marker of check.markers) {
        if (!content.includes(marker)) {
          errors.push(
            `Sibling ${check.repo}/${check.file} missing expected contract marker '${marker}'`,
          );
        }
      }
    }
  }

  // 4. Validate Arazzo workflow specification and Angular HttpClient SDK generation via ../cdd-ts when available
  if (fs.existsSync(CDD_TS_INDEX)) {
    const cddTs = await import(pathToFileURL(CDD_TS_INDEX).href);
    const arazzoRaw = JSON.parse(
      fs.readFileSync(path.join(CONTRACTS_DIR, 'cdd-platform.arazzo.json'), 'utf8'),
    );
    const arazzoErrors = cddTs.validateArazzoSpec(arazzoRaw);
    if (Array.isArray(arazzoErrors) && arazzoErrors.length > 0) {
      for (const err of arazzoErrors) {
        errors.push(`cdd-ts Arazzo validation error: ${err}`);
      }
    }

    const tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdd-web-ui-conformance-'));
    try {
      await cddTs.generateFromOpenApi(
        buildAngularHttpClientOptions(backendSpecPath, tmpOutDir),
        'to_sdk',
      );
      const generatedServicesDir = path.join(tmpOutDir, 'services');
      const generatedServiceFiles = fs.existsSync(generatedServicesDir)
        ? fs
            .readdirSync(generatedServicesDir)
            .filter((f) => f.endsWith('.service.ts'))
            .sort()
        : [];
      const expectedServiceMap = {
        'api.service.ts': parseTsDefinitions(path.join(ROOT, 'src/app/services/api.service.ts'))
          .methods,
        'artifactStorage.service.ts': parseTsDefinitions(
          path.join(ROOT, 'src/app/services/artifact-storage.service.ts'),
        ).methods,
        'mcpRpc.service.ts': parseTsDefinitions(
          path.join(ROOT, 'src/app/services/mcp-rpc.service.ts'),
        ).methods,
      };
      const expectedServiceNames = Object.keys(expectedServiceMap).sort();
      if (JSON.stringify(generatedServiceFiles) !== JSON.stringify(expectedServiceNames)) {
        errors.push(
          `cdd-ts generated Angular services [${generatedServiceFiles.join(', ')}] do not match expected client shape [${expectedServiceNames.join(', ')}]`,
        );
      }
      const cddTsGeneratedMethods = new Set();
      for (const gsf of generatedServiceFiles) {
        const fullGsf = path.join(generatedServicesDir, gsf);
        const raw = fs.readFileSync(fullGsf, 'utf8');
        if (!raw.includes('@angular/common/http') || !raw.includes('inject(HttpClient)')) {
          errors.push(
            `cdd-ts generated Angular service '${gsf}' is missing Angular HttpClient injection`,
          );
        }
        const { methods } = parseTsDefinitions(fullGsf);
        const clientServiceMethods = expectedServiceMap[gsf];
        for (const m of methods) {
          cddTsGeneratedMethods.add(m);
          if (
            m !== 'createContextWithClientId' &&
            clientServiceMethods &&
            !clientServiceMethods.has(m)
          ) {
            errors.push(
              `cdd-ts generated method '${m}' in '${gsf}' is missing on the corresponding cdd-web-ui Angular service`,
            );
          }
        }
      }
      for (const opId of expectedOperationIds) {
        if (!cddTsGeneratedMethods.has(opId)) {
          errors.push(`cdd-ts Angular HttpClient generator did not emit operation '${opId}'`);
        }
      }
    } finally {
      fs.rmSync(tmpOutDir, { recursive: true, force: true });
    }
  }

  if (errors.length > 0) {
    console.error('Backend conformance check failed:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `Backend conformance verified: ${checkedOperations} operations and ${checkedSchemas} schemas aligned across cdd-web-ui, ../cdd-ops, and ../cdd-ts Angular HttpClient generator.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await checkBackendConformance();
}
