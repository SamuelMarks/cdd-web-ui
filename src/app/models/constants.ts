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
    /** id */
    id: 'c',
    /** name */
    name: 'C (C89)',
    /** repo */
    repo: 'cdd-c',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/c.svg',
  },
  {
    /** id */
    id: 'cpp',
    /** name */
    name: 'C++',
    /** repo */
    repo: 'cdd-cpp',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/cpp.svg',
  },
  {
    /** id */
    id: 'csharp',
    /** name */
    name: 'C#',
    /** repo */
    repo: 'cdd-csharp',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/csharp.svg',
  },
  {
    /** id */
    id: 'go',
    /** name */
    name: 'Go',
    /** repo */
    repo: 'cdd-go',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/go.svg',
  },
  {
    /** id */
    id: 'java',
    /** name */
    name: 'Java',
    /** repo */
    repo: 'cdd-java',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/java.svg',
  },
  {
    /** id */
    id: 'kotlin',
    /** name */
    name: 'Kotlin',
    /** repo */
    repo: 'cdd-kotlin',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/kotlin.svg',
  },
  {
    /** id */
    id: 'php',
    /** name */
    name: 'PHP',
    /** repo */
    repo: 'cdd-php',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/php.svg',
  },
  {
    /** id */
    id: 'python',
    /** name */
    name: 'Python',
    /** repo */
    repo: 'cdd-python',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/python.svg',
  },
  {
    /** id */
    id: 'ruby',
    /** name */
    name: 'Ruby',
    /** repo */
    repo: 'cdd-ruby',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/ruby.svg',
  },
  {
    /** id */
    id: 'rust',
    /** name */
    name: 'Rust',
    /** repo */
    repo: 'cdd-rust',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: true,
    /** iconUrl */
    iconUrl: '/assets/icons/rust.svg',
  },
  {
    /** id */
    id: 'sh',
    /** name */
    name: 'Shell',
    /** repo */
    repo: 'cdd-sh',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/sh.svg',
  },
  {
    /** id */
    id: 'swift',
    /** name */
    name: 'Swift',
    /** repo */
    repo: 'cdd-swift',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: false,
    /** iconUrl */
    iconUrl: '/assets/icons/swift.svg',
  },
  {
    /** id */
    id: 'typescript',
    /** name */
    name: 'TypeScript',
    /** repo */
    repo: 'cdd-ts',
    /** availableInWasm */
    availableInWasm: true,
    /** selectedByDefault */
    selectedByDefault: true,
    /** iconUrl */
    iconUrl: '/assets/icons/typescript.svg',
  },
];

/** Base URL for the API Docs UI iframe. */
export const DOCS_UI_BASE_URL = '/docs-ui/index.html';
