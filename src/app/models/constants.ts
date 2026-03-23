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
    id: 'c',
    name: 'C (C89)',
    repo: 'cdd-c',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/c.svg',
  },
  {
    id: 'cpp',
    name: 'C++',
    repo: 'cdd-cpp',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/cpp.svg',
  },
  {
    id: 'csharp',
    name: 'C#',
    repo: 'cdd-csharp',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/csharp.svg',
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
    id: 'java',
    name: 'Java',
    repo: 'cdd-java',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/java.svg',
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    repo: 'cdd-kotlin',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/kotlin.svg',
  },
  {
    id: 'php',
    name: 'PHP',
    repo: 'cdd-php',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/php.svg',
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
    id: 'ruby',
    name: 'Ruby',
    repo: 'cdd-ruby',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/ruby.svg',
  },
  {
    id: 'rust',
    name: 'Rust',
    repo: 'cdd-rust',
    availableInWasm: true,
    selectedByDefault: true,
    iconUrl: '/assets/icons/rust.svg',
  },
  {
    id: 'sh',
    name: 'Shell',
    repo: 'cdd-sh',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/sh.svg',
  },
  {
    id: 'swift',
    name: 'Swift',
    repo: 'cdd-swift',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/swift.svg',
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    repo: 'cdd-ts',
    availableInWasm: true,
    selectedByDefault: true,
    iconUrl: '/assets/icons/typescript.svg',
  },
];
