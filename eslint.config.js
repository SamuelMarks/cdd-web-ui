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
      '@typescript-eslint/no-explicit-any': 'warn',
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
