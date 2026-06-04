/**
 * Default environment configuration.
 * @module environments/environment
 */

import { LanguageConfig } from '../app/models/types';

/**
 * Environment variables for the application.
 */
export const environment: {
  /** Array of supported languages. */
  languages: LanguageConfig[];
  /** Whether the UI should be in single language mode. */
  singleLanguageMode: boolean;
  /** Application header title */
  appName: string;
  /** Application footer text */
  footerText: string;
  /** Approximate size of WASM binaries */
  wasmSizeText: string;
  /** Text for the load WASM button */
  loadWasmButtonText: string;
  /** Whether to eagerly load WASM on startup without a prompt */
  eagerLoadWasm: boolean;
} = {
  singleLanguageMode: false,
  eagerLoadWasm: false,
  appName: 'CDD (WASM) web UI',
  footerText: '© 2026 Compiler Driven Development (CDD) WASM web demo.',
  wasmSizeText: '~295MB',
  loadWasmButtonText: 'Load ~295MB of WASM',
  languages: [
    {
      id: 'c',
      name: 'C (C89)',
      repo: 'cdd-c',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/c.svg',
    },
    {
      id: 'cpp',
      name: 'C++',
      repo: 'cdd-cpp',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/cpp.svg',
    },
    {
      id: 'csharp',
      name: 'C#',
      repo: 'cdd-csharp',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/csharp.svg',
    },
    {
      id: 'go',
      name: 'Go',
      repo: 'cdd-go',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/go.svg',
    },
    {
      id: 'java',
      name: 'Java',
      repo: 'cdd-java',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/java.svg',
    },
    {
      id: 'kotlin',
      name: 'Kotlin',
      repo: 'cdd-kotlin',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/kotlin.svg',
    },
    {
      id: 'php',
      name: 'PHP',
      repo: 'cdd-php',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/php.svg',
    },
    {
      id: 'python',
      name: 'Python',
      repo: 'cdd-python-all',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/python.svg',
    },
    {
      id: 'ruby',
      name: 'Ruby',
      repo: 'cdd-ruby',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/ruby.svg',
    },
    {
      id: 'rust',
      name: 'Rust',
      repo: 'cdd-rust',
      availableInWasm: true,
      selectedByDefault: true,
      iconUrl: 'assets/icons/rust.svg',
    },
    {
      id: 'sh',
      name: 'Shell',
      repo: 'cdd-sh',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/sh.svg',
    },
    {
      id: 'swift',
      name: 'Swift',
      repo: 'cdd-swift',
      availableInWasm: true,
      selectedByDefault: false,
      iconUrl: 'assets/icons/swift.svg',
    },
    {
      id: 'typescript',
      name: 'TypeScript',
      repo: 'cdd-ts',
      availableInWasm: true,
      selectedByDefault: true,
      iconUrl: 'assets/icons/typescript.svg',
    },
  ],
};
