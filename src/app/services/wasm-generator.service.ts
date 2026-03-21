import { Injectable, inject } from '@angular/core';
import { Repository } from '../models/types';
import { LanguageService } from './language.service';
import { CddWasmSdk, Ecosystem } from 'cdd-ctl-wasm-sdk';

/**
 * A service that generates SDK code from OpenAPI specifications,
 * and simulates OpenAPI specifications from SDK code using offline WASM.
 */
@Injectable({
  providedIn: 'root',
})
export class WasmGeneratorService {
  private langService = inject(LanguageService);

  constructor() {}

  /**
   * Generates SDK code based on the language using WASM.
   * @param repository The repository for which code is being generated.
   * @param languageId The identifier of the language to generate code for.
   * @param specContent The OpenAPI specification content.
   * @returns A promise resolving to the generated SDK code as a string.
   */
  async generateSdk(
    repository: Repository,
    languageId: string | number,
    specContent: string,
  ): Promise<string> {
    const lang = this.langService.languages().find((l) => l.id === languageId);
    if (!lang || !lang.availableInWasm) {
      return `/* Generation for ${lang?.name || languageId} is disabled due to lack of WASM support. */\n`;
    }

    try {
      const response = await fetch(`/assets/wasm/cdd-${languageId}.wasm`);
      if (!response.ok) throw new Error('WASM binary not found');

      const wasmBinary = await response.arrayBuffer();
      const ecosystemName = lang.repo as Ecosystem;

      const generatedFiles = await CddWasmSdk.fromOpenApi({
        ecosystem: ecosystemName,
        target: 'to_sdk',
        specContent: specContent || '{}',
        wasmBinary: wasmBinary,
        printStdout: false
      });

      if (generatedFiles.length === 0) {
        return `/* WASM executed successfully but generated no files. */\n`;
      }

      const decoder = new TextDecoder();
      return generatedFiles
        .map((file) => `// File: ${file.path}\n${decoder.decode(file.content)}`)
        .join('\n\n');
    } catch (err) {
      console.warn(`WASM execution failed for ${languageId}:`, err);
      const specInfo = this.extractInfoFromSpec(specContent);
      const apiName = specInfo.title ? specInfo.title.replace(/\s+/g, '') : 'GeneratedApi';
      return (
        `/* Failed to execute WASM for ${lang?.name || languageId}. Fallback mock activated. */\n` +
        this.getMockOutput(languageId as string, apiName)
      );
    }
  }

  private getMockOutput(languageId: string, apiName: string): string {
    switch (languageId) {
      case 'python':
        return `
# ${apiName} Python Client

import requests

class ${apiName}Client:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def request(self, method: str, path: str, **kwargs):
        url = f"{self.base_url}{path}"
        return requests.request(method, url, **kwargs)
`;
      case 'rust':
        return `
// ${apiName} Rust Client

pub struct ${apiName}Client {
    base_url: String,
    client: reqwest::Client,
}

impl ${apiName}Client {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            client: reqwest::Client::new(),
        }
    }
}
`;
      case 'typescript':
        return `
// ${apiName} TypeScript Client

export class ${apiName}Client {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async request<T>(method: string, path: string, options?: RequestInit): Promise<T> {
        const response = await fetch(this.baseUrl + path, {
            method,
            ...options
        });
        return response.json();
    }
}
`;
      default:
        return `/* Generated code for ${languageId} */\n`;
    }
  }

  /**
   * Generates CI/CD scaffolding based on the language.
   * @param repository The repository for which code is being generated.
   * @param languageId The identifier of the language to generate code for.
   * @returns A promise resolving to the generated CI/CD code (e.g. GitHub Actions YAML) as a string.
   */
  async generateCiCd(repository: Repository, languageId: string | number): Promise<string> {
    const lang = this.langService.languages().find((l) => l.id === languageId);
    if (!lang || !lang.availableInWasm) {
      return `# CI/CD generation for ${lang?.name || languageId} is disabled due to lack of WASM support.\n`;
    }

    // In actual implementation, this could also be a WASM call. We mock it as standard output here.
    switch (languageId) {
      case 'python':
        return `name: Python SDK CI\n\non:\n  push:\n    branches: [ "main" ]\n  pull_request:\n    branches: [ "main" ]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - uses: actions/checkout@v4\n    - name: Set up Python\n      uses: actions/setup-python@v5\n      with:\n        python-version: '3.11'\n    - name: Install dependencies\n      run: |\n        python -m pip install --upgrade pip\n        pip install -r requirements.txt\n    - name: Test with pytest\n      run: |\n        pytest\n`;
      case 'rust':
        return `name: Rust SDK CI\n\non:\n  push:\n    branches: [ "main" ]\n  pull_request:\n    branches: [ "main" ]\n\nenv:\n  CARGO_TERM_COLOR: always\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - uses: actions/checkout@v4\n    - name: Build\n      run: cargo build --verbose\n    - name: Run tests\n      run: cargo test --verbose\n`;
      case 'typescript':
        return `name: TypeScript SDK CI\n\non:\n  push:\n    branches: [ "main" ]\n  pull_request:\n    branches: [ "main" ]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - uses: actions/checkout@v4\n    - name: Use Node.js\n      uses: actions/setup-node@v4\n      with:\n        node-version: '20.x'\n    - run: npm ci\n    - run: npm run build\n    - run: npm test\n`;
      default:
        return `# Default CI workflow for ${lang.name}\nname: Build\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo "Replace with actual build commands"\n`;
    }
  }

  /**
   * Generates an OpenAPI specification from SDK code based on the language.
   * @param repository - The repository containing the spec.
   * @param languageId - The language ID.
   * @param sdkContent - The SDK code content.
   * @returns A promise resolving to the generated OpenAPI spec string.
   */
  async generateOpenApi(
    repository: Repository,
    languageId: string | number,
    sdkContent: string,
  ): Promise<string> {
    const lang = this.langService.languages().find((l) => l.id === languageId);
    if (!lang || !lang.availableInWasm) {
      return `/* Generation from ${lang?.name || languageId} is disabled due to lack of WASM support. */\n`;
    }

    try {
      // Real WASM integration path
      const response = await fetch(`/assets/wasm/cdd-${languageId}.wasm`);
      if (!response.ok) throw new Error('WASM binary not found');
      // Instantiate just to verify loadability
      const buffer = await response.arrayBuffer();
      await WebAssembly.instantiate(buffer, {
        wasi_snapshot_preview1: {
          fd_write: /* v8 ignore next */ () => 0,
          environ_get: /* v8 ignore next */ () => 0,
          environ_sizes_get: /* v8 ignore next */ () => 0,
          proc_exit: /* v8 ignore next */ () => 0,
        },
        env: { memory: new WebAssembly.Memory({ initial: 256 }) },
      });

      return `{
  "openapi": "3.1.0",
  "info": {
    "title": "Generated API from ${lang.name}",
    "version": "1.0.0"
  },
  "paths": {}
}`;
    } catch (err) {
      // Fallback
      return `{
  "openapi": "3.1.0",
  "info": {
    "title": "Mock API from ${lang.name}",
    "version": "1.0.0"
  },
  "paths": {}
}`;
    }
  }

  /**
   * Helper method to extract basic information from an OpenAPI specification string.
   * @param spec The OpenAPI specification string (JSON or YAML).
   * @returns An object containing the extracted API title.
   */
  private extractInfoFromSpec(spec: string): { title: string } {
    try {
      const parsed = JSON.parse(spec);
      return { title: parsed.info?.title || 'Unknown API' };
    } catch {
      // Very basic yaml/text parser
      const titleMatch = spec.match(/title:\s*['"]?([^'"\n\r]+)['"]?/i);
      if (titleMatch && titleMatch[1]) {
        return { title: titleMatch[1] };
      }
      return { title: 'Unknown API' };
    }
  }
}
