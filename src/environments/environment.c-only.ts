/**
 * C-only environment configuration.
 * @module environments/environment.c-only
 */

import { LanguageConfig } from '../app/models/types';

/**
 * Environment variables for the application in C-only mode.
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
  singleLanguageMode: true,
  eagerLoadWasm: true,
  appName: 'rewriteInC WASM frontend',
  footerText: '© 2026 rewriteInC.io',
  wasmSizeText: '~1MB',
  loadWasmButtonText: 'Load ~1MB of WASM',
  languages: [
    {
      id: 'c',
      name: 'C (C89)',
      repo: 'cdd-c',
      availableInWasm: true,
      selectedByDefault: true,
      iconUrl: 'assets/icons/c.svg',
    },
  ],
};
