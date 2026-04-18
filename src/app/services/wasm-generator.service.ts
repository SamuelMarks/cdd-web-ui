import { Injectable, inject } from '@angular/core';
import { Repository } from '../models/types';
import { LanguageService } from './language.service';
import { BackendConfigService } from './backend-config.service';
import { HttpClient } from '@angular/common/http';
import { CddWasmSdk, Ecosystem } from 'cdd-ctl-wasm-sdk';
import * as yaml from 'js-yaml';

/**
 * A service that generates SDK code from OpenAPI specifications,
 * and simulates OpenAPI specifications from SDK code using offline WASM.
 */
@Injectable({
  providedIn: 'root',
})
export class WasmGeneratorService {
  private langService = inject(LanguageService);
  private configService = inject(BackendConfigService);
  private http = inject(HttpClient);

  constructor() {}

  async generateSdk(
    repository: Repository,
    languageId: string | number,
    specContent: string,
  ): Promise<string> {
    const lang = this.langService.languages().find((l) => l.id === languageId);
    if (!lang || !lang.availableInWasm) {
      return `/* Generation for ${lang?.name || languageId} is disabled due to lack of WASM support. */\n`;
    }

    const runMode = this.configService.runMode();
    const ecosystemName = lang.repo as Ecosystem;

    let finalSpecContent = specContent || '{}';
    if (typeof finalSpecContent === 'string' && !finalSpecContent.trim().startsWith('{')) {
      try {
        const parsed = yaml.load(finalSpecContent);
        if (parsed && typeof parsed === 'object') {
          finalSpecContent = JSON.stringify(parsed, null, 2);
        }
      } catch (e) {
        console.warn(`[WasmGenerator] Failed to parse YAML, continuing with raw string.`, e);
      }
    }

    if (runMode === 'local_cdd_ctl_native' || runMode === 'local_cdd_ctl_wasm') {
      const baseUrl = this.configService.backendUrl();
      if (!baseUrl) {
        return `/* Error: Backend URL must be configured for ${runMode} mode. */\n`;
      }
      try {
        const payload = {
          jsonrpc: '2.0',
          method: 'to_sdk',
          params: { target_language: ecosystemName, input: finalSpecContent },
          id: 1,
        };
        const response: unknown = await this.http.post(baseUrl, payload).toPromise();
        const res = response as { error?: { message?: string }; result?: { code?: string } };
        if (res?.error) {
          throw new Error(res.error.message || 'RPC Error');
        }
        return res?.result?.code || `/* Generated successfully via backend */\n`;
      } catch (err) {
        console.warn(`Backend execution failed for ${languageId}:`, err);
        return (
          `/* Failed to execute via ${runMode}. Fallback mock activated. */\n` +
          this.getMockOutput(languageId as string, 'GeneratedApi')
        );
      }
    }

    try {
      let url = `https://github.com/SamuelMarks/cdd-web-ui/releases/download/latest/${lang.repo}.wasm`;
      if (runMode === 'served_github') {
        const repoOrg =
          ecosystemName.startsWith('cdd-python') ||
          ecosystemName === 'cdd-ts' ||
          ecosystemName === 'cdd-kotlin'
            ? 'offscale'
            : 'SamuelMarks';
        url = `https://github.com/${repoOrg}/${ecosystemName}/releases/latest/download/${ecosystemName.replace('cdd-', '')}.wasm`;
      } else {
        url = `/assets/wasm/${lang.repo}.wasm`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('WASM binary not found');

      const wasmBinary = await response.arrayBuffer();

      const generatedFiles = await CddWasmSdk.fromOpenApi({
        ecosystem: ecosystemName,
        target: 'to_sdk',
        specContent: finalSpecContent,
        wasmBinary: wasmBinary,
        printStdout: false,
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
        `/* Failed to execute WASM for ${lang.name}. Fallback mock activated. */\n` +
        this.getMockOutput(languageId as string, apiName)
      );
    }
  }

  private getMockOutput(languageId: string, apiName: string): string {
    switch (languageId) {
      case 'python':
        return `\n# ${apiName} Python Client\nimport requests\nclass ${apiName}Client:\n    def __init__(self, base_url: str):\n        self.base_url = base_url\n\n    def request(self, method: str, path: str, **kwargs):\n        url = f"{self.base_url}{path}"\n        return requests.request(method, url, **kwargs)\n`;
      case 'rust':
        return `\n// ${apiName} Rust Client\npub struct ${apiName}Client {\n    base_url: String,\n    client: reqwest::Client,\n}\nimpl ${apiName}Client {\n    pub fn new(base_url: String) -> Self {\n        Self {\n            base_url,\n            client: reqwest::Client::new(),\n        }\n    }\n}\n`;
      case 'typescript':
        return `\n// ${apiName} TypeScript Client\nexport class ${apiName}Client {\n    private baseUrl: string;\n    constructor(baseUrl: string) {\n        this.baseUrl = baseUrl;\n    }\n    async request<T>(method: string, path: string, options?: RequestInit): Promise<T> {\n        const response = await fetch(this.baseUrl + path, { method, ...options });\n        return response.json();\n    }\n}\n`;
      default:
        return `/* Generated code for ${languageId} */\n`;
    }
  }

  async generateCiCd(repository: Repository, languageId: string | number): Promise<string> {
    const lang = this.langService.languages().find((l) => l.id === languageId);
    if (!lang || !lang.availableInWasm) {
      return `# CI/CD generation for ${lang?.name || languageId} is disabled due to lack of WASM support.\n`;
    }
    switch (languageId) {
      case 'python':
        return `name: Python SDK CI\non:\n  push:\n    branches: [ "main" ]\n  pull_request:\n    branches: [ "main" ]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - uses: actions/checkout@v4\n    - name: Set up Python\n      uses: actions/setup-python@v5\n      with:\n        python-version: '3.11'\n    - name: Install dependencies\n      run: |\n        python -m pip install --upgrade pip\n        pip install -r requirements.txt\n    - name: Test with pytest\n      run: |\n        pytest\n`;
      case 'rust':
        return `name: Rust SDK CI\non:\n  push:\n    branches: [ "main" ]\n  pull_request:\n    branches: [ "main" ]\nenv:\n  CARGO_TERM_COLOR: always\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - uses: actions/checkout@v4\n    - name: Build\n      run: cargo build --verbose\n    - name: Run tests\n      run: cargo test --verbose\n`;
      case 'typescript':
        return `name: TypeScript SDK CI\non:\n  push:\n    branches: [ "main" ]\n  pull_request:\n    branches: [ "main" ]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - uses: actions/checkout@v4\n    - name: Use Node.js\n      uses: actions/setup-node@v4\n      with:\n        node-version: '20.x'\n    - run: npm ci\n    - run: npm run build\n    - run: npm test\n`;
      default:
        return `# Default CI workflow for ${lang?.name}\nname: Build\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo "Replace with actual build commands"\n`;
    }
  }

  async generateOpenApi(
    repository: Repository,
    languageId: string | number,
    sdkContent: string,
  ): Promise<string> {
    const lang = this.langService.languages().find((l) => l.id === languageId);
    if (!lang || !lang.availableInWasm) {
      return `/* Generation from ${lang?.name || languageId} is disabled due to lack of WASM support. */\n`;
    }

    const runMode = this.configService.runMode();
    const ecosystemName = lang.repo as Ecosystem;

    try {
      let url = `https://github.com/SamuelMarks/cdd-web-ui/releases/download/latest/${lang.repo}.wasm`;
      if (runMode === 'served_github') {
        const repoOrg =
          ecosystemName.startsWith('cdd-python') ||
          ecosystemName === 'cdd-ts' ||
          ecosystemName === 'cdd-kotlin'
            ? 'offscale'
            : 'SamuelMarks';
        url = `https://github.com/${repoOrg}/${ecosystemName}/releases/latest/download/${ecosystemName.replace('cdd-', '')}.wasm`;
      } else {
        url = `/assets/wasm/${lang.repo}.wasm`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('WASM binary not found');

      const buffer = await response.arrayBuffer();
      await WebAssembly.instantiate(buffer, {
        wasi_snapshot_preview1: {
          fd_write: () => 0,
          environ_get: () => 0,
          environ_sizes_get: () => 0,
          proc_exit: () => 0,
        },
        env: { memory: new WebAssembly.Memory({ initial: 256 }) },
      });

      return `{\n  "openapi": "3.1.0",\n  "info": {\n    "title": "Generated API from ${lang.name}",\n    "version": "1.0.0"\n  },\n  "paths": {}\n}`;
    } catch (err) {
      return `{\n  "openapi": "3.1.0",\n  "info": {\n    "title": "Mock API from ${lang.name}",\n    "version": "1.0.0"\n  },\n  "paths": {}\n}`;
    }
  }

  private extractInfoFromSpec(spec: string): { title?: string } {
    try {
      const parsed = JSON.parse(spec);
      return { title: parsed.info?.title };
    } catch {
      const titleMatch = spec.match(/title:\s*['"]?([^'"\n\r]+)['"]?/i);
      if (titleMatch && titleMatch[1]) {
        return { title: titleMatch[1] };
      }
      return {};
    }
  }
}
