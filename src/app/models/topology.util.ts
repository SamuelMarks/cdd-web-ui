/**
 * Pure utility functions for GitHub Organization slug normalization and
 * Monorepo (`${GITHUB_ORG_NAME}-sdk`) vs. Polyrepo (`${GITHUB_ORG_NAME}-sdk-${LANGUAGE}`) naming and file path layout.
 * @module app/models/topology.util
 */

import { CanonicalLanguageId, RepoTopologyConfig } from './types';

/**
 * Canonical list of all 13 supported target language identifiers.
 */
export const ALL_CANONICAL_LANGUAGE_IDS: readonly CanonicalLanguageId[] = [
  'c',
  'cpp',
  'csharp',
  'go',
  'java',
  'kotlin',
  'php',
  'python',
  'ruby',
  'rust',
  'sh',
  'swift',
  'typescript',
];

/**
 * Map of common display names and ecosystem identifiers to canonical short repository language slugs.
 */
const LANGUAGE_SLUG_ALIASES: Readonly<Record<string, string>> = {
  c: 'c',
  'c (c89)': 'c',
  'cdd-c': 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  'cdd-cpp': 'cpp',
  csharp: 'csharp',
  'c#': 'csharp',
  'cdd-csharp': 'csharp',
  go: 'go',
  'cdd-go': 'go',
  java: 'java',
  'cdd-java': 'java',
  kotlin: 'kotlin',
  'cdd-kotlin': 'kotlin',
  php: 'php',
  'cdd-php': 'php',
  python: 'python',
  'cdd-python-all': 'python',
  ruby: 'ruby',
  'cdd-ruby': 'ruby',
  rust: 'rust',
  'cdd-rust': 'rust',
  sh: 'sh',
  shell: 'sh',
  'cdd-sh': 'sh',
  swift: 'swift',
  'cdd-swift': 'swift',
  typescript: 'ts',
  ts: 'ts',
  'cdd-ts': 'ts',
};

/**
 * Normalizes a GitHub organization or user handle into a lowercase URL/repository-safe slug,
 * falling back to `'my-org'` when the input is empty or contains no alphanumeric characters.
 * @param githubOrgName Raw GitHub organization or username input.
 * @returns Normalized organization slug string.
 */
export function normalizeOrgSlug(githubOrgName: string): string {
  const cleaned = githubOrgName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : 'my-org';
}

/**
 * Normalizes a language identifier, display label, or `cdd-*` ecosystem name into a concise repository slug.
 * @param languageId Language ID, display name, or ecosystem identifier.
 * @returns Normalized short language slug (e.g., `'ts'`, `'rust'`, `'python'`, `'csharp'`, `'cpp'`).
 */
export function normalizeLanguageSlug(languageId: string): string {
  const lowered = languageId.trim().toLowerCase();
  const alias = LANGUAGE_SLUG_ALIASES[lowered];
  if (alias) {
    return alias;
  }
  const stripped = lowered
    .replace(/^cdd-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return stripped.length > 0 ? stripped : 'sdk';
}

/**
 * Computes the default Monorepo name `${GITHUB_ORG_NAME}-sdk` for a given GitHub organization handle.
 * @param githubOrgName GitHub organization or user handle.
 * @returns Default monorepo repository name (`${orgSlug}-sdk`).
 */
export function getDefaultMonorepoName(githubOrgName: string): string {
  return `${normalizeOrgSlug(githubOrgName)}-sdk`;
}

/**
 * Computes the default Polyrepo name `${GITHUB_ORG_NAME}-sdk-${LANGUAGE}` for a given GitHub organization and language.
 * @param githubOrgName GitHub organization or user handle.
 * @param languageId Target language identifier or display name.
 * @returns Default per-language repository name (`${orgSlug}-sdk-${langSlug}`).
 */
export function getDefaultPolyrepoName(githubOrgName: string, languageId: string): string {
  return `${normalizeOrgSlug(githubOrgName)}-sdk-${normalizeLanguageSlug(languageId)}`;
}

/**
 * Builds a map of default per-language repository names (`${GITHUB_ORG_NAME}-sdk-${LANGUAGE}`) for all provided languages.
 * @param githubOrgName GitHub organization or user handle.
 * @param languageIds List of target language identifiers.
 * @returns Record mapping each language ID to its default polyrepo name.
 */
export function buildDefaultPolyrepoMap(
  githubOrgName: string,
  languageIds: readonly string[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const lang of languageIds) {
    map[lang] = getDefaultPolyrepoName(githubOrgName, lang);
  }
  return map;
}

/**
 * Reconciles a `RepoTopologyConfig` when the GitHub organization handle or enabled languages change.
 * Automatically updates `monorepoName` and `polyrepoNames[lang]` to the new `${nextOrgName}-sdk*` defaults
 * if they were previously empty or matched the previous organization's default names, while preserving any
 * custom names explicitly edited by the user.
 * @param prev Previous repository topology configuration.
 * @param nextOrgName Updated GitHub organization or user handle.
 * @param enabledLanguages Currently enabled language identifiers.
 * @returns Reconciled repository topology configuration.
 */
export function reconcileTopologyConfig(
  prev: RepoTopologyConfig,
  nextOrgName: string,
  enabledLanguages: readonly string[],
): RepoTopologyConfig {
  const prevDefaultMono = getDefaultMonorepoName(prev.githubOrgName);
  const nextDefaultMono = getDefaultMonorepoName(nextOrgName);
  const trimmedPrevMono = prev.monorepoName.trim();
  const nextMonorepoName =
    trimmedPrevMono.length === 0 || trimmedPrevMono === prevDefaultMono
      ? nextDefaultMono
      : prev.monorepoName;

  const nextPolyrepoNames: Record<string, string> = {};
  for (const lang of enabledLanguages) {
    const existing = prev.polyrepoNames[lang]?.trim() ?? '';
    const prevDefaultPoly = getDefaultPolyrepoName(prev.githubOrgName, lang);
    const nextDefaultPoly = getDefaultPolyrepoName(nextOrgName, lang);
    nextPolyrepoNames[lang] =
      existing.length === 0 || existing === prevDefaultPoly ? nextDefaultPoly : existing;
  }

  return {
    githubOrgName: nextOrgName,
    topologyMode: prev.topologyMode,
    monorepoName: nextMonorepoName,
    polyrepoNames: nextPolyrepoNames,
  };
}

/**
 * Prefixes generated file paths according to the active repository topology configuration:
 * - In `'monorepo'` mode: `${monorepoName}/${langSlug}/${file.path}`
 * - In `'polyrepo'` mode: `${polyrepoName}/${file.path}`
 * @param files Array of file objects containing a `path` property.
 * @param config Active repository topology configuration.
 * @param languageId Target language identifier for the generated files.
 * @returns New array of file objects with topology-prefixed paths.
 */
export function prefixFilesForTopology<
  T extends {
    /** Relative file path within the generated SDK. */
    readonly path: string;
  },
>(files: readonly T[], config: RepoTopologyConfig, languageId: string): T[] {
  const langSlug = normalizeLanguageSlug(languageId);
  const prefix =
    config.topologyMode === 'monorepo'
      ? `${config.monorepoName.trim() || getDefaultMonorepoName(config.githubOrgName)}/${langSlug}`
      : config.polyrepoNames[languageId]?.trim() ||
        getDefaultPolyrepoName(config.githubOrgName, languageId);

  return files.map((file: T): T => {
    const cleanPath = file.path.replace(/^\/+/, '');
    return {
      ...file,
      path: `${prefix}/${cleanPath}`,
    };
  });
}
