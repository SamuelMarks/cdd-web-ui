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
      include: ['src/app/**/*.ts'],
      exclude: ['src/app/**/*.spec.ts', 'src/app/**/*.mock.ts'],
    },
  },
});
