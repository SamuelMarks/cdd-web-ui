/**
 * Application-wide constants.
 * @module models/constants
 */

import { LanguageConfig } from './types';

/**
 * A list of supported languages and their configuration.
 */
export const LANGUAGES: LanguageConfig[] = [
  {
    id: 'typescript',
    name: 'TypeScript',
    repo: 'cdd-typescript',
    availableInWasm: true,
    selectedByDefault: true,
    iconUrl: '/assets/icons/typescript.svg',
  },
  {
    id: 'python',
    name: 'Python',
    repo: 'cdd-python',
    availableInWasm: true,
    selectedByDefault: false,
    iconUrl: '/assets/icons/python.svg',
  },
  {
    id: 'java',
    name: 'Java',
    repo: 'cdd-java',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/java.svg',
  },
  {
    id: 'go',
    name: 'Go',
    repo: 'cdd-go',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/go.svg',
  },
  {
    id: 'rust',
    name: 'Rust',
    repo: 'cdd-rust',
    availableInWasm: true,
    selectedByDefault: true,
    iconUrl: '/assets/icons/rust.svg',
  },
];
