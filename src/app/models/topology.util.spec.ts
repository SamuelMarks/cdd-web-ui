import { describe, expect, it } from 'vitest';
import {
  ALL_CANONICAL_LANGUAGE_IDS,
  buildDefaultPolyrepoMap,
  getDefaultMonorepoName,
  getDefaultPolyrepoName,
  normalizeLanguageSlug,
  normalizeOrgSlug,
  prefixFilesForTopology,
  reconcileTopologyConfig,
} from './topology.util';
import { RepoTopologyConfig } from './types';

describe('topology.util', () => {
  it('lists all 13 canonical language IDs', () => {
    expect(ALL_CANONICAL_LANGUAGE_IDS).toEqual([
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
    ]);
    expect(ALL_CANONICAL_LANGUAGE_IDS.length).toBe(13);
  });

  describe('normalizeOrgSlug', () => {
    it('normalizes mixed case and special characters', () => {
      expect(normalizeOrgSlug('  OffScale_Org.Inc!  ')).toBe('offscale_org-inc');
    });

    it('falls back to my-org when input is empty or only punctuation', () => {
      expect(normalizeOrgSlug('')).toBe('my-org');
      expect(normalizeOrgSlug('   ---!!!---   ')).toBe('my-org');
    });
  });

  describe('normalizeLanguageSlug', () => {
    it('maps known display names and ecosystem identifiers to canonical slugs', () => {
      expect(normalizeLanguageSlug('TypeScript')).toBe('ts');
      expect(normalizeLanguageSlug('cdd-ts')).toBe('ts');
      expect(normalizeLanguageSlug('C#')).toBe('csharp');
      expect(normalizeLanguageSlug('cdd-csharp')).toBe('csharp');
      expect(normalizeLanguageSlug('C++')).toBe('cpp');
      expect(normalizeLanguageSlug('C (C89)')).toBe('c');
      expect(normalizeLanguageSlug('cdd-python-all')).toBe('python');
      expect(normalizeLanguageSlug('Shell')).toBe('sh');
      expect(normalizeLanguageSlug('Rust')).toBe('rust');
    });

    it('normalizes unknown custom language identifiers and falls back to sdk when empty', () => {
      expect(normalizeLanguageSlug('cdd-zig_lang!')).toBe('zig-lang');
      expect(normalizeLanguageSlug('   ')).toBe('sdk');
      expect(normalizeLanguageSlug('cdd-!!!')).toBe('sdk');
    });
  });

  describe('getDefaultMonorepoName and getDefaultPolyrepoName', () => {
    it('computes ${GITHUB_ORG_NAME}-sdk and ${GITHUB_ORG_NAME}-sdk-${LANGUAGE}', () => {
      expect(getDefaultMonorepoName('acme-corp')).toBe('acme-corp-sdk');
      expect(getDefaultPolyrepoName('acme-corp', 'typescript')).toBe('acme-corp-sdk-ts');
      expect(getDefaultPolyrepoName('acme-corp', 'rust')).toBe('acme-corp-sdk-rust');
      expect(getDefaultPolyrepoName('', 'python')).toBe('my-org-sdk-python');
    });

    it('builds default polyrepo map for a list of languages', () => {
      const map = buildDefaultPolyrepoMap('offscale', ['rust', 'typescript', 'python']);
      expect(map).toEqual({
        rust: 'offscale-sdk-rust',
        typescript: 'offscale-sdk-ts',
        python: 'offscale-sdk-python',
      });
    });
  });

  describe('reconcileTopologyConfig', () => {
    it('updates default monorepo and polyrepo names when organization changes', () => {
      const prev: RepoTopologyConfig = {
        githubOrgName: 'old-org',
        topologyMode: 'monorepo',
        monorepoName: 'old-org-sdk',
        polyrepoNames: {
          rust: 'old-org-sdk-rust',
          typescript: 'old-org-sdk-ts',
        },
      };

      const next = reconcileTopologyConfig(prev, 'new-org', ['rust', 'typescript', 'go']);
      expect(next).toEqual({
        githubOrgName: 'new-org',
        topologyMode: 'monorepo',
        monorepoName: 'new-org-sdk',
        polyrepoNames: {
          rust: 'new-org-sdk-rust',
          typescript: 'new-org-sdk-ts',
          go: 'new-org-sdk-go',
        },
      });
    });

    it('preserves custom user-edited monorepo and polyrepo names when organization changes', () => {
      const prev: RepoTopologyConfig = {
        githubOrgName: 'old-org',
        topologyMode: 'polyrepo',
        monorepoName: 'custom-monorepo-name',
        polyrepoNames: {
          rust: 'custom-rust-client',
          typescript: 'old-org-sdk-ts',
        },
      };

      const next = reconcileTopologyConfig(prev, 'new-org', ['rust', 'typescript']);
      expect(next.monorepoName).toBe('custom-monorepo-name');
      expect(next.polyrepoNames['rust']).toBe('custom-rust-client');
      expect(next.polyrepoNames['typescript']).toBe('new-org-sdk-ts');
    });

    it('populates default monorepo name when previous monorepoName was blank', () => {
      const prev: RepoTopologyConfig = {
        githubOrgName: 'old-org',
        topologyMode: 'monorepo',
        monorepoName: '   ',
        polyrepoNames: {},
      };

      const next = reconcileTopologyConfig(prev, 'acme', ['c']);
      expect(next.monorepoName).toBe('acme-sdk');
      expect(next.polyrepoNames['c']).toBe('acme-sdk-c');
    });
  });

  describe('prefixFilesForTopology', () => {
    const sampleFiles = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
      { path: '/README.md', content: '# SDK' },
    ];

    it('prefixes files with ${monorepoName}/${langSlug}/ in monorepo mode', () => {
      const config: RepoTopologyConfig = {
        githubOrgName: 'acme',
        topologyMode: 'monorepo',
        monorepoName: 'acme-sdk',
        polyrepoNames: {},
      };
      const prefixed = prefixFilesForTopology(sampleFiles, config, 'typescript');
      expect(prefixed).toEqual([
        { path: 'acme-sdk/ts/src/index.ts', content: 'export const x = 1;' },
        { path: 'acme-sdk/ts/README.md', content: '# SDK' },
      ]);
    });

    it('falls back to default monorepo name when monorepoName is empty in monorepo mode', () => {
      const config: RepoTopologyConfig = {
        githubOrgName: 'acme',
        topologyMode: 'monorepo',
        monorepoName: '   ',
        polyrepoNames: {},
      };
      const prefixed = prefixFilesForTopology(sampleFiles, config, 'rust');
      expect(prefixed[0].path).toBe('acme-sdk/rust/src/index.ts');
    });

    it('prefixes files with ${polyrepoName}/ in polyrepo mode (custom and fallback)', () => {
      const config: RepoTopologyConfig = {
        githubOrgName: 'acme',
        topologyMode: 'polyrepo',
        monorepoName: 'acme-sdk',
        polyrepoNames: {
          typescript: 'custom-ts-repo',
        },
      };
      const tsPrefixed = prefixFilesForTopology(sampleFiles, config, 'typescript');
      expect(tsPrefixed[0].path).toBe('custom-ts-repo/src/index.ts');

      const pyPrefixed = prefixFilesForTopology(sampleFiles, config, 'python');
      expect(pyPrefixed[0].path).toBe('acme-sdk-python/src/index.ts');
    });
  });
});
