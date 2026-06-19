import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  resolve: {
    alias: {
      'cdd-browser-sdk': '/tests/mocks/cdd-browser-sdk.ts',
    },
  },
  optimizeDeps: {
    exclude: ['cdd-browser-sdk'],
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['setup.ts'],
    include: ['src/**/*.spec.ts'],
    server: {
      deps: {
        inline: [/cdd-browser-sdk/, /@bjorn3\/browser_wasi_shim/, /@angular\/compiler/],
      },
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'json-summary'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.mock.ts'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
