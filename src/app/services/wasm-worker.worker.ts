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

/** Allow CddJavaBrowser to temporarily override console.log logs without losing its reference */
let originalInterceptLog = (...args: unknown[]) => {
  postMessage({ status: 'log', level: 'INFO', message: args.map((a) => String(a)).join(' ') });
  originalLog(...args);
};

/** Allow CddJavaBrowser to temporarily override console.info logs without losing its reference */
let originalInterceptInfo = (...args: unknown[]) => {
  postMessage({ status: 'log', level: 'INFO', message: args.map((a) => String(a)).join(' ') });
  originalInfo(...args);
};

console.log = (...args) => {
  originalInterceptLog(...args);
};
console.info = (...args) => {
  originalInterceptInfo(...args);
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
  if (data && data.payload && data.payload.ecosystem === 'cdd-java') {
    if (typeof self !== 'undefined' && !(self as unknown as { GraalVM?: unknown }).GraalVM) {
      try {
        const urlToFetch =
          data.payload.cddJavaJsUrl || location.origin + '/assets/wasm/cdd-java.js';
        console.log(`Worker loading cdd-java.js via fetch+eval from ${urlToFetch}...`);
        const resp = await fetch(urlToFetch);
        const scriptStr = await resp.text();
        const globalEval = eval;
        globalEval('var window = self; var globalThis = self; ' + scriptStr);
        if ((self as unknown as { GraalVM?: unknown }).GraalVM) {
          try {
            (globalThis as unknown as { GraalVM?: unknown }).GraalVM = (
              self as unknown as Record<string, unknown>
            )['GraalVM'];
          } catch (e) {}
        }
      } catch (e2) {
        console.warn('Failed to load cdd-java.js inside worker via fetch+eval', e2);
      }
    }
  }

  let jobId = data.jobId;
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
          additionalArgs.push('--framework', languageOptions.framework as string);
        }
        if (languageOptions.serverFramework) {
          additionalArgs.push('--serverFramework', languageOptions.serverFramework as string);
        }
        if (languageOptions.orm) {
          additionalArgs.push('--orm', languageOptions.orm as string);
        }
        if (languageOptions.noGithubActions) {
          additionalArgs.push('--no-github-actions');
        }
        if (languageOptions.noInstallablePackage) {
          additionalArgs.push('--no-installable-package');
        }
        if (languageOptions.tests) {
          additionalArgs.push('--tests');
        }
        if (languageOptions.noImports) {
          additionalArgs.push('--no-imports');
        }
        if (languageOptions.noWrapping) {
          additionalArgs.push('--no-wrapping');
        }
      }

      if (languageOptions && languageOptions.upgradeOpenApi && ecosystem === 'cdd-cpp') {
        additionalArgs.push('--upgrade-openapi-3.2.0');
      }

      console.info(`[Worker] Starting WASM generation for ${ecosystem}...`);

      if (ecosystem === 'cdd-csharp') {
        type CsharpExports = {
          BrowserInterop: { GenerateFromOpenApi: (a: string, b: string, c: string) => string };
        };
        const globalRef = globalThis as unknown as { _cddCsharpExports?: CsharpExports };
        let csharpExports = globalRef._cddCsharpExports;
        if (!csharpExports) {
          console.info(`[Worker] Booting .NET browser-wasm runtime for cdd-csharp...`);
          const dotnetJsUrl = location.origin + '/assets/wasm/cdd-csharp/dotnet.js';
          const module = await import(/* @vite-ignore */ dotnetJsUrl);
          const { dotnet } = module;
          const { getAssemblyExports, getConfig } = await dotnet
            .withDiagnosticTracing(false)
            .withResourceLoader(
              (
                type: string,
                name: string,
                defaultUri: string,
                integrity: string,
                behavior: string,
              ) => {
                return location.origin + '/assets/wasm/cdd-csharp/' + name;
              },
            )
            .create();
          const config = getConfig();
          csharpExports = (await getAssemblyExports(config.mainAssemblyName)) as CsharpExports;
          globalRef._cddCsharpExports = csharpExports;
        }

        const resultStr = csharpExports.BrowserInterop.GenerateFromOpenApi(
          finalSpecContent as string,
          'from_openapi',
          target || 'to_sdk',
        );
        const resultJson = JSON.parse(resultStr);
        if (resultJson.error) {
          throw new Error(resultJson.error);
        }

        const files = [];
        for (const [path, content] of Object.entries(resultJson)) {
          files.push({ path, content: new TextEncoder().encode(content as string) });
        }
        postMessage({ status: 'success', jobId, data: files });
        return;
      }

      const generatedFiles = await CddWasmSdk.fromOpenApi({
        ecosystem,
        target: target || 'to_sdk',
        specContent: finalSpecContent,
        wasmBinary,
        printStdout: true, // Let it print, we've intercepted console
        additionalArgs,
        // @ts-ignore
        cddJavaJsUrl: data.payload.cddJavaJsUrl,
        // @ts-ignore
        cddJavaWasmUrl: data.payload.cddJavaWasmUrl,
      });

      console.info(`[Worker] Finished generating ${generatedFiles.length} files.`);
      postMessage({ status: 'success', jobId, data: generatedFiles });
    } else {
      postMessage({ status: 'error', jobId, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error(`[Worker] Error:`, error);
    postMessage({
      status: 'error',
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
