import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.js',
            'playwright.config.ts',
            'vitest.config.ts',
            'e2e/app.spec.ts',
            'e2e/wasm.spec.ts',
            'e2e/docs-ui.spec.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': true,
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            object: {
              message:
                'Avoid the `object` type; use an explicit interface or `Record<string, unknown>` instead.',
            },
            Any: {
              message: 'Avoid `Any`; use an explicit type or `unknown` instead.',
            },
          },
        },
      ],
    },
  },
  {
    ignores: [
      '.angular/',
      'coverage/',
      'dist/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
      'documentation/',
      'public/assets/',
      'scripts/',
      '*.js',
      '**/*.d.ts',
    ],
  },
);
