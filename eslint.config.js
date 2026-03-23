const eslintPluginTypeScript = require('@typescript-eslint/eslint-plugin');
const eslintParserTypeScript = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: [
      "**/*.js", "node_modules/**", "dist/**", "out-tsc/**", 
      "coverage/**", "doc-out/**", "documentation/**", "playwright-report/**"
    ]
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: eslintParserTypeScript,
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.js",
            "playwright.config.ts",
            "vitest.config.ts",
            "e2e/app.spec.ts"
          ]
        },
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      "@typescript-eslint": eslintPluginTypeScript,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
];
