import { Injectable } from '@angular/core';
import { Repository } from '../models/types';
import { LANGUAGES } from '../models/constants';

/**
 * A service that simulates the generation of SDK code from OpenAPI specifications,
 * and OpenAPI specifications from SDK code using offline WASM.
 */
@Injectable({
  providedIn: 'root',
})
export class WasmGeneratorService {
  constructor() {}

  /**
   * Stubs generation of SDK code based on the language.
   * @param repository The repository for which code is being generated.
   * @param languageId The identifier of the language to generate code for.
   * @param specContent The OpenAPI specification content.
   * @returns A promise resolving to the generated SDK code as a string.
   */
  async generateSdk(
    repository: Repository,
    languageId: string,
    specContent: string,
  ): Promise<string> {
    const lang = LANGUAGES.find((l) => l.id === languageId);
    if (!lang || !lang.availableInWasm) {
      return `/* Generation for ${lang?.name || languageId} is disabled due to lack of WASM support. */
`;
    }

    // A simple mock for SDK generation output
    const specInfo = this.extractInfoFromSpec(specContent);
    const apiName = specInfo.title ? specInfo.title.replace(/\s+/g, '') : 'GeneratedApi';

    switch (languageId) {
      case 'python':
        return `
# ${apiName} Python Client
# Generated offline via WASM stub

import requests

class ${apiName}Client:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def request(self, method: str, path: str, **kwargs):
        url = f"{self.base_url}{path}"
        return requests.request(method, url, **kwargs)

# Additional generated models would appear here
`;
      case 'rust':
        return `
// ${apiName} Rust Client
// Generated offline via WASM stub

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
// Generated offline via WASM stub

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
        return `/* Generated code for ${lang.name} */
`;
    }
  }

  /**
   * Stubs generation of an OpenAPI specification from SDK code based on the language.
   * @param repository - The repository containing the spec.
   * @param languageId - The language ID.
   * @param sdkContent - The SDK code content.
   * @returns A promise resolving to the generated OpenAPI spec string.
   */
  async generateOpenApi(
    repository: Repository,
    languageId: string,
    sdkContent: string,
  ): Promise<string> {
    const lang = LANGUAGES.find((l) => l.id === languageId);
    if (!lang || !lang.availableInWasm) {
      return `/* Generation from ${lang?.name || languageId} is disabled due to lack of WASM support. */\n`;
    }

    // A simple mock for OpenAPI generation output
    return `{
  "openapi": "3.1.0",
  "info": {
    "title": "Generated API from ${lang.name}",
    "version": "1.0.0"
  },
  "paths": {}
}`;
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
      const titleMatch = spec.match(/title:\s*['"]?([^'"]+)['"]?/i);
      if (titleMatch && titleMatch[1]) {
        return { title: titleMatch[1] };
      }
      return { title: 'Unknown API' };
    }
  }
}
