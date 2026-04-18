/// <reference lib="webworker" />
import { CddWasmSdk } from 'cdd-ctl-wasm-sdk';
import * as yaml from 'js-yaml';

// Intercept console.log and other methods to send back to the main thread
/** Original console.log reference */
const originalLog = console.log;
/** Original console.info reference */
const originalInfo = console.info;
/** Original console.warn reference */
const originalWarn = console.warn;
/** Original console.error reference */
const originalError = console.error;

console.log = (...args) => {
  postMessage({ status: 'log', level: 'INFO', message: args.map((a) => String(a)).join(' ') });
  originalLog(...args);
};

console.info = (...args) => {
  postMessage({ status: 'log', level: 'INFO', message: args.map((a) => String(a)).join(' ') });
  originalInfo(...args);
};

console.warn = (...args) => {
  postMessage({ status: 'log', level: 'WARN', message: args.map((a) => String(a)).join(' ') });
  originalWarn(...args);
};

console.error = (...args) => {
  postMessage({ status: 'log', level: 'ERROR', message: args.map((a) => String(a)).join(' ') });
  originalError(...args);
};

addEventListener('message', async ({ data }) => {
  try {
    const { action, payload } = data;

    if (action === 'generateSdk') {
      const { ecosystem, specContent, wasmBinary, target, languageOptions } = payload;

      let finalSpecContent = specContent;
      if (typeof specContent === 'string' && !specContent.trim().startsWith('{')) {
        try {
          const parsed = yaml.load(specContent);
          if (parsed && typeof parsed === 'object') {
            finalSpecContent = JSON.stringify(parsed, null, 2);
          }
        } catch (e) {
          console.warn(`[Worker] Failed to parse YAML, continuing with raw string.`, e);
        }
      }

      const additionalArgs: string[] = [];
      if (languageOptions) {
        if (languageOptions.autoAdmin) {
          additionalArgs.push('--admin');
        }
        if (languageOptions.framework) {
          additionalArgs.push('--framework', languageOptions.framework);
        }
        if (languageOptions.noGithubActions) {
          additionalArgs.push('--no-github-actions');
        }
        if (languageOptions.noInstallablePackage) {
          additionalArgs.push('--no-installable-package');
        }
      }

      if (languageOptions && languageOptions.upgradeOpenApi && ecosystem === 'cdd-cpp') {
        additionalArgs.push('--upgrade-openapi-3.2.0');
      }

      console.info(`[Worker] Starting WASM generation for ${ecosystem}...`);

      const generatedFiles = await CddWasmSdk.fromOpenApi({
        ecosystem,
        target: target || 'to_sdk',
        specContent: finalSpecContent,
        wasmBinary,
        printStdout: true, // Let it print, we've intercepted console
        additionalArgs,
      });

      console.info(`[Worker] Finished generating ${generatedFiles.length} files.`);
      postMessage({ status: 'success', data: generatedFiles });
    } else {
      postMessage({ status: 'error', error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error(`[Worker] Error:`, error);
    postMessage({ status: 'error', error: error instanceof Error ? error.message : String(error) });
  }
});
