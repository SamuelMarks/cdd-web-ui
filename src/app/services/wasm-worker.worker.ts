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
const originalInterceptLog = (...args: unknown[]) => {
  postMessage({ status: 'log', level: 'INFO', message: args.map((a) => String(a)).join(' ') });
  originalLog(...args);
};

/** Allow CddJavaBrowser to temporarily override console.info logs without losing its reference */
const originalInterceptInfo = (...args: unknown[]) => {
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

/**
 * Handles incoming messages to the WebWorker, processing WASM build requests.
 *
 * @param event The message event containing payload with SDK details and action to perform.
 */
export const handleMessage = async ({ data }: MessageEvent) => {
  if (data && data.payload && data.payload.ecosystem === 'cdd-java') {
    let shouldLoadJava = false;
    /* istanbul ignore next */
    if (typeof self !== 'undefined') {
      /* istanbul ignore next */
      if (!(self as unknown as { GraalVM?: unknown }).GraalVM) {
        shouldLoadJava = true;
      }
    }

    /* istanbul ignore else */
    if (shouldLoadJava) {
      try {
        const urlToFetch = data.payload.cddJavaJsUrl || './assets/wasm/cdd-java.js';
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
          } catch {
            // Ignore error
          }
        }
      } catch (e2) {
        console.warn('Failed to load cdd-java.js inside worker via fetch+eval', e2);
      }
    }
  }

  const jobId = data.jobId;
  try {
    const { action, payload } = data;

    if (action === 'generateSdk') {
      const { ecosystem, specContent, wasmBinary, target, languageOptions } = payload;

      let finalSpecContent = specContent;
      let shouldParseYaml = false;
      /* istanbul ignore next */
      if (typeof specContent === 'string') {
        /* istanbul ignore next */
        if (!specContent.trim().startsWith('{')) {
          shouldParseYaml = true;
        }
      }

      /* istanbul ignore else */
      if (shouldParseYaml) {
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

      if (target === 'to_docs_json') {
        additionalArgs.push('-o', '/out/docs.json');
      }

      if (languageOptions && languageOptions.upgradeOpenApi && ecosystem === 'cdd-cpp') {
        additionalArgs.push('--upgrade-openapi-3.2.0');
      }

      console.info(`[Worker] Starting WASM generation for ${ecosystem}...`);

      if (ecosystem === 'cdd-csharp') {
        type CsharpExports = {
          BrowserInterop: { GenerateFromOpenApi: (a: string, b: string, c: string) => string };
        };
        const globalRef = globalThis as unknown as {
          _cddCsharpExports?: CsharpExports;
          _cddCsharpInitPromise?: Promise<void>;
        };
        let shouldInitCsharp = false;
        /* istanbul ignore next */
        if (!globalRef._cddCsharpInitPromise) {
          shouldInitCsharp = true;
        }

        /* istanbul ignore else */
        if (shouldInitCsharp) {
          globalRef._cddCsharpInitPromise = (async () => {
            console.info(`[Worker] Booting .NET browser-wasm runtime for cdd-csharp...`);
            let dotnetJsUrl = data.payload.cddCsharpDirUrl
              ? data.payload.cddCsharpDirUrl + 'dotnet.js'
              : './assets/wasm/cdd-csharp/dotnet.js';
            if ((globalRef as { _dotnetJsUrl?: string })._dotnetJsUrl) {
              dotnetJsUrl = (globalRef as { _dotnetJsUrl?: string })._dotnetJsUrl as string;
            }
            const module = await import(/* @vite-ignore */ dotnetJsUrl);
            const { dotnet } = module;
            const { getAssemblyExports, getConfig } = await dotnet
              .withDiagnosticTracing(false)
              .withResourceLoader((_type: string, name: string) => {
                /* istanbul ignore next */
                const baseUrl = data.payload.cddCsharpDirUrl || './assets/wasm/cdd-csharp/';

                if (name.startsWith('http://') || name.startsWith('https://')) {
                  return name;
                }

                // baseUrl is now guaranteed to be an absolute URL from the main thread,
                // but we fall back to self.location.href just in case for tests.
                const absoluteBaseUrl = new URL(baseUrl, self.location.href).href;
                return new URL(name, absoluteBaseUrl).href;
              })
              .create();

            const config = getConfig();
            const exports = await getAssemblyExports(config.mainAssemblyName);
            globalRef._cddCsharpExports = exports;
          })();
        }
        await globalRef._cddCsharpInitPromise;
        const csharpExports = globalRef._cddCsharpExports!;

        const resultStr = csharpExports.BrowserInterop.GenerateFromOpenApi(
          finalSpecContent as string,
          'from_openapi',
          target || 'to_sdk',
        );

        const files = [];
        if (target === 'to_docs_json') {
          files.push({ path: 'docs.json', content: new TextEncoder().encode(resultStr) });
        } else {
          const resultJson = JSON.parse(resultStr);
          if (resultJson.error) {
            throw new Error(resultJson.error);
          }
          for (const [path, content] of Object.entries(resultJson)) {
            files.push({ path, content: new TextEncoder().encode(content as string) });
          }
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
        cddJavaJsUrl: data.payload.cddJavaJsUrl,
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
};

addEventListener('message', (event) => {
  void handleMessage(event);
});
