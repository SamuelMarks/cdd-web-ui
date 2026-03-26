import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  resolve: {
    alias: {
      'cdd-ctl-wasm-sdk': require('path').resolve(__dirname, '__mock_cdd_ctl_wasm_sdk.js'),
    },
  },
  optimizeDeps: {
    exclude: ['cdd-ctl-wasm-sdk'],
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['setup.ts'],
    include: ['src/**/*.spec.ts'],
    server: {
      deps: {
        inline: [/cdd-ctl-wasm-sdk/, /@bjorn3\/browser_wasi_shim/],
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
