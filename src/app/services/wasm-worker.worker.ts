/**
 * Web Worker entry point for executing CDD WASM compilers (WASI, GraalVM Java, .NET C#, Pyodide Python, Javy TS).
 * @module app/services/wasm-worker.worker
 */
/// <reference lib="webworker" />
import { CddWasmSdk } from 'cdd-browser-sdk';
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

/** Optional active log capture callback used by in-memory WASM runners (e.g. GraalVM). */
let activeLogCapture: ((...args: unknown[]) => void) | null = null;

/** Allow CddJavaBrowser to temporarily override console.log logs without losing its reference */
const originalInterceptLog = (...args: unknown[]): void => {
  activeLogCapture?.(...args);
  postMessage({ status: 'log', level: 'INFO', message: args.map((a) => String(a)).join(' ') });
  originalLog(...args);
};

/** Allow CddJavaBrowser to temporarily override console.info logs without losing its reference */
const originalInterceptInfo = (...args: unknown[]): void => {
  activeLogCapture?.(...args);
  postMessage({ status: 'log', level: 'INFO', message: args.map((a) => String(a)).join(' ') });
  originalInfo(...args);
};

console.log = (...args: unknown[]): void => {
  originalInterceptLog(...args);
};
console.info = (...args: unknown[]): void => {
  originalInterceptInfo(...args);
};

console.warn = (...args: unknown[]): void => {
  postMessage({ status: 'log', level: 'WARN', message: args.map((a) => String(a)).join(' ') });
  originalWarn(...args);
};

console.error = (...args: unknown[]): void => {
  postMessage({ status: 'log', level: 'ERROR', message: args.map((a) => String(a)).join(' ') });
  originalError(...args);
};

/**
 * Minimal interface for the GraalVM WasmGC runtime loaded by `cdd-java.js`.
 */
interface GraalVmRuntime {
  /** Optional Config constructor on GraalVM runtime. */
  Config?: new () => {
    /** Explicit URL or path to the `.wasm` binary. */
    wasm_path?: string;
  };
  /**
   * Executes the compiled Java entry point with the given CLI arguments.
   * @param args Command-line arguments passed to `cli.Main`.
   * @param config Optional GraalVM configuration object.
   * @returns Promise resolving when execution completes.
   */
  run: (
    args: string[],
    config?: {
      /** Explicit URL or path to the `.wasm` binary. */
      wasm_path?: string;
    },
  ) => Promise<void>;
}

/**
 * Result returned by the `CddJavaBrowserEngine` WasmGC wrapper.
 */
interface CddJavaResult {
  /** Map of relative file paths to their generated string contents. */
  files: Record<string, string>;
}

/**
 * Browser/WebWorker WasmGC execution engine for `cdd-java` using GraalVM's `process_in_memory` protocol.
 */
export class CddJavaBrowserEngine {
  /** Mutex queue ensuring sequential GraalVM runs and isolated console capture. */
  private static runQueue: Promise<unknown> = Promise.resolve();

  /** URL to the `cdd-java` WasmGC binary. */
  private readonly wasmPath: string;

  /**
   * Creates a new `CddJavaBrowserEngine` instance.
   * @param wasmPath URL to the `cdd-java.wasm` or `cdd-java.js.wasm` binary.
   */
  constructor(wasmPath: string = './assets/wasm/cdd-java.js.wasm') {
    this.wasmPath = wasmPath;
  }

  /**
   * Executes a `cdd-java` command in memory via `GraalVM.run(["process_in_memory", payload])`.
   * @param commandArgs CLI command and flags array.
   * @param inputFiles Virtual input file map.
   * @returns Promise resolving to the generated file map.
   */
  async run(
    commandArgs: string[],
    inputFiles: Record<string, string> = {},
  ): Promise<CddJavaResult> {
    const task = CddJavaBrowserEngine.runQueue.then(() =>
      this.executeSerialized(commandArgs, inputFiles),
    );
    CddJavaBrowserEngine.runQueue = task.catch(() => undefined);
    return task;
  }

  /**
   * Internal serialized execution of `GraalVM.run(["process_in_memory", payload])`.
   * @param commandArgs CLI command and flags array.
   * @param inputFiles Virtual input file map.
   * @returns Promise resolving to the generated file map.
   */
  private async executeSerialized(
    commandArgs: string[],
    inputFiles: Record<string, string>,
  ): Promise<CddJavaResult> {
    const graal = (
      globalThis as unknown as {
        /** Global GraalVM runtime object. */
        GraalVM?: GraalVmRuntime;
      }
    ).GraalVM;
    if (!graal) {
      throw new Error('GraalVM runtime is not loaded.');
    }

    const payload = JSON.stringify({
      command: commandArgs,
      files: inputFiles,
    });

    let outputStr = '';

    const capture = (...args: unknown[]): void => {
      outputStr += args.map((a) => String(a)).join(' ') + '\n';
    };

    activeLogCapture = capture;

    try {
      if (graal.Config) {
        const cfg = new graal.Config();
        cfg.wasm_path = this.wasmPath;
        await graal.run(['process_in_memory', payload], cfg);
      } else {
        await graal.run(['process_in_memory', payload]);
      }
    } finally {
      activeLogCapture = null;
    }

    const startMarker = 'CDD_IN_MEMORY_START';
    const endMarker = 'CDD_IN_MEMORY_END';
    const startIdx = outputStr.indexOf(startMarker);
    const endIdx = outputStr.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const jsonStr = outputStr.substring(startIdx + startMarker.length, endIdx).trim();
      const parsed = JSON.parse(jsonStr) as {
        /** Whether in-memory compilation succeeded. */
        success?: boolean;
        /** Error message when compilation failed. */
        error?: string;
        /** Generated files map. */
        files?: Record<string, string>;
      };
      if (!parsed.success) {
        throw new Error(`cdd-java execution error: ${parsed.error || 'Unknown error'}`);
      }
      return { files: parsed.files || {} };
    }
    throw new Error(`cdd-java did not return a valid in-memory response.`);
  }

  /**
   * Generates server code from an OpenAPI specification string.
   * @param specJsonStr OpenAPI specification JSON string.
   * @returns Promise resolving to generated files.
   */
  async generateServer(specJsonStr: string): Promise<CddJavaResult> {
    return this.run(['from_openapi', 'to_server', '-i', 'spec.json'], {
      'spec.json': specJsonStr,
    });
  }

  /**
   * Generates CLI SDK code from an OpenAPI specification string.
   * @param specJsonStr OpenAPI specification JSON string.
   * @param noGithubActions Whether to omit GitHub Actions workflows.
   * @param noInstallablePackage Whether to omit installable package boilerplate.
   * @param tests Whether to generate test suites.
   * @returns Promise resolving to generated files.
   */
  async generateSdkCli(
    specJsonStr: string,
    noGithubActions: boolean = false,
    noInstallablePackage: boolean = false,
    tests: boolean = false,
  ): Promise<CddJavaResult> {
    const args = ['from_openapi', 'to_sdk_cli', '-i', 'spec.json'];
    if (noGithubActions) args.push('--no-github-actions');
    if (noInstallablePackage) args.push('--no-installable-package');
    if (tests) args.push('--tests');
    return this.run(args, { 'spec.json': specJsonStr });
  }

  /**
   * Generates ORM code from an OpenAPI specification string.
   * @param specJsonStr OpenAPI specification JSON string.
   * @returns Promise resolving to generated files.
   */
  async generateOrm(specJsonStr: string): Promise<CddJavaResult> {
    return this.run(['from_openapi', 'to_orm', '-i', 'spec.json'], {
      'spec.json': specJsonStr,
    });
  }

  /**
   * Generates client SDK code from an OpenAPI specification string.
   * @param specJsonStr OpenAPI specification JSON string.
   * @param noGithubActions Whether to omit GitHub Actions workflows.
   * @param noInstallablePackage Whether to omit installable package boilerplate.
   * @param tests Whether to generate test suites.
   * @returns Promise resolving to generated files.
   */
  async generateSdk(
    specJsonStr: string,
    noGithubActions: boolean = false,
    noInstallablePackage: boolean = false,
    tests: boolean = false,
  ): Promise<CddJavaResult> {
    const args = ['from_openapi', 'to_sdk', '-i', 'spec.json'];
    if (noGithubActions) args.push('--no-github-actions');
    if (noInstallablePackage) args.push('--no-installable-package');
    if (tests) args.push('--tests');
    return this.run(args, { 'spec.json': specJsonStr });
  }
}

/**
 * Reconstructs a minimal OpenAPI 3.2.0 specification from C++ or TypeScript model definitions
 * when a single-file `to_openapi` invocation produces no output file.
 * @param sourceText Input source code string.
 * @returns Array containing a single `openapi.json` file entry.
 */
export function extractSchemasToOpenApiFallback(sourceText: string): {
  /** Relative file path. */
  path: string;
  /** Binary file content. */
  content: Uint8Array;
}[] {
  const schemas: Record<string, Record<string, unknown>> = {};
  const blockRegex = /(?:export\s+)?(?:interface|struct|class)\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(sourceText)) !== null) {
    const name = match[1];
    schemas[name] = {
      type: 'object',
      properties: {},
    };
  }
  const doc = {
    openapi: '3.2.0',
    info: {
      title: 'Extracted API',
      version: '1.0.0',
    },
    paths: {},
    components: {
      schemas,
    },
  };
  return [
    {
      path: 'openapi.json',
      content: new TextEncoder().encode(JSON.stringify(doc, null, 2)),
    },
  ];
}

/**
 * Checks whether a serialized `docs.json` string already contains structured snippet records
 * (`imports`, `wrapper_start` / `wrapperStart`, `snippet` / `code`, `wrapper_end` / `wrapperEnd`).
 * @param jsonStr Serialized `docs.json` content string.
 * @returns True if at least one operation snippet is already a structured object.
 */
export function isStructuredDocsJson(jsonStr: string): boolean {
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    const rec: Record<string, unknown> | null =
      Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object'
        ? (parsed[0] as Record<string, unknown>)
        : typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
    if (!rec) return false;

    const endpoints = rec['endpoints'];
    if (typeof endpoints === 'object' && endpoints !== null) {
      for (const methods of Object.values(endpoints as Record<string, unknown>)) {
        if (typeof methods === 'object' && methods !== null) {
          for (const leaf of Object.values(methods as Record<string, unknown>)) {
            if (typeof leaf === 'object' && leaf !== null) {
              return true;
            }
          }
        }
      }
    }
    const operations = rec['operations'];
    if (Array.isArray(operations)) {
      return operations.some(
        (op: unknown): boolean =>
          typeof op === 'object' &&
          op !== null &&
          typeof (op as Record<string, unknown>)['code'] === 'object' &&
          (op as Record<string, unknown>)['code'] !== null,
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Combines up to 4 flat-string `(±no-imports, ±no-wrapping)` `docs.json` variant payloads
 * into a single structured `docs.json` payload containing `{ imports, wrapper_start, snippet, wrapper_end }`.
 * @param variants Object containing `full`, `noImports`, `noWrapping`, and `bare` JSON strings.
 * @returns Serialized structured `docs.json` string.
 */
export function mergeFlatDocsJsonVariants(variants: {
  /** Full output with imports and wrapping. */
  full: string;
  /** Output generated with `--no-imports`. */
  noImports?: string;
  /** Output generated with `--no-wrapping`. */
  noWrapping?: string;
  /** Output generated with `--no-imports --no-wrapping`. */
  bare?: string;
}): string {
  try {
    const parseEndpoints = (raw?: string): Record<string, Record<string, unknown>> | null => {
      if (!raw) return null;
      const p: unknown = JSON.parse(raw);
      const root =
        Array.isArray(p) && p.length > 0 && typeof p[0] === 'object' && p[0] !== null
          ? (p[0] as Record<string, unknown>)
          : typeof p === 'object' && p !== null && !Array.isArray(p)
            ? (p as Record<string, unknown>)
            : null;
      const eps = root?.['endpoints'];
      return typeof eps === 'object' && eps !== null && !Array.isArray(eps)
        ? (eps as Record<string, Record<string, unknown>>)
        : null;
    };

    const fullEps = parseEndpoints(variants.full);
    if (!fullEps) return variants.full;
    const noImportsEps = parseEndpoints(variants.noImports);
    const noWrappingEps = parseEndpoints(variants.noWrapping);
    const bareEps = parseEndpoints(variants.bare);

    const getStr = (
      eps: Record<string, Record<string, unknown>> | null,
      route: string,
      method: string,
    ): string | null => {
      const val = eps?.[route]?.[method];
      return typeof val === 'string' ? val : null;
    };

    const mergedEndpoints: Record<string, Record<string, unknown>> = {};
    for (const [route, methods] of Object.entries(fullEps)) {
      if (typeof methods !== 'object' || methods === null) continue;
      mergedEndpoints[route] = {};
      for (const [method, leaf] of Object.entries(methods)) {
        if (typeof leaf !== 'string') {
          mergedEndpoints[route][method] = leaf;
          continue;
        }
        const fullStr = leaf.trim();
        const noImpStr = (getStr(noImportsEps, route, method) ?? fullStr).trim();
        const noWrapStr = (getStr(noWrappingEps, route, method) ?? fullStr).trim();
        const bareStr = (getStr(bareEps, route, method) ?? noWrapStr).trim();

        let imports = '';
        const bareIdxInNoWrap = bareStr ? noWrapStr.indexOf(bareStr) : -1;
        if (bareIdxInNoWrap > 0) {
          imports = noWrapStr.slice(0, bareIdxInNoWrap).trim();
        } else {
          const noImpIdxInFull = fullStr.indexOf(noImpStr);
          if (noImpIdxInFull > 0) {
            imports = fullStr.slice(0, noImpIdxInFull).trim();
          }
        }

        const bareIdxInNoImp = bareStr ? noImpStr.indexOf(bareStr) : -1;
        const wrapperStart = bareIdxInNoImp >= 0 ? noImpStr.slice(0, bareIdxInNoImp).trim() : '';
        const wrapperEnd =
          bareIdxInNoImp >= 0 ? noImpStr.slice(bareIdxInNoImp + bareStr.length).trim() : '';

        mergedEndpoints[route][method] = {
          imports,
          wrapper_start: wrapperStart,
          snippet: bareStr || fullStr,
          wrapper_end: wrapperEnd,
        };
      }
    }
    return JSON.stringify({ endpoints: mergedEndpoints });
  } catch {
    return variants.full;
  }
}

/**
 * Handles incoming messages to the WebWorker, processing WASM build requests.
 *
 * @param event The message event containing payload with SDK details and action to perform.
 * @returns Promise resolving once the message request has been handled.
 */
export const handleMessage = async (event: MessageEvent): Promise<void> => {
  const { data } = event;
  if (data && data.payload && data.payload.ecosystem === 'cdd-java') {
    const globalObj = globalThis as unknown as {
      /** CddJavaBrowser constructor registered on globalThis. */
      CddJavaBrowser?: typeof CddJavaBrowserEngine;
    };
    if (!globalObj.CddJavaBrowser) {
      globalObj.CddJavaBrowser = CddJavaBrowserEngine;
    }

    let shouldLoadJava = false;

    if (typeof self !== 'undefined') {
      if (
        !(
          self as unknown as {
            /** GraalVM global runtime object. */
            GraalVM?: unknown;
          }
        ).GraalVM
      ) {
        shouldLoadJava = true;
      }
    }

    if (shouldLoadJava) {
      try {
        const urlToFetch = data.payload.cddJavaJsUrl || './assets/wasm/cdd-java.js';
        console.log(`Worker loading cdd-java.js via fetch+eval from ${urlToFetch}...`);
        const resp = await fetch(urlToFetch);
        const scriptStr = await resp.text();
        const globalEval = eval;
        globalEval('var window = self; ' + scriptStr);
        if (
          (
            self as unknown as {
              /** GraalVM global runtime object. */
              GraalVM?: unknown;
            }
          ).GraalVM
        ) {
          try {
            (
              globalThis as unknown as {
                /** GraalVM global runtime object. */
                GraalVM?: unknown;
              }
            ).GraalVM = (self as unknown as Record<string, unknown>)['GraalVM'];
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

    if (action === 'generateSdk' || action === 'to_docs_json') {
      const { ecosystem, specContent, wasmBinary, languageOptions } = payload;
      const target = action === 'to_docs_json' ? payload.target || 'to_docs_json' : payload.target;

      let finalSpecContent = specContent;
      let shouldParseYaml = false;

      if (typeof specContent === 'string' && target !== 'to_openapi') {
        if (!specContent.trim().startsWith('{')) {
          shouldParseYaml = true;
        }
      }

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
        if (languageOptions.mcp) {
          additionalArgs.push('--mcp');
        }
        if (languageOptions.withEphemeral) {
          additionalArgs.push('--with-ephemeral');
        }
        if (languageOptions.withSeed) {
          additionalArgs.push('--with-seed');
        }
        if (languageOptions.noGenerateServices) {
          additionalArgs.push('--no-generate-services');
        }
        if (languageOptions.noTestGen) {
          additionalArgs.push('--no-test-gen');
        }
        if (languageOptions.noImports) {
          additionalArgs.push('--no-imports');
        }
        if (languageOptions.noWrapping) {
          additionalArgs.push('--no-wrapping');
        }
      }

      if (
        ecosystem === 'cdd-ts' &&
        target === 'to_docs_json' &&
        payload.framework &&
        !additionalArgs.includes('--framework')
      ) {
        additionalArgs.push('--framework', String(payload.framework));
      }

      if (languageOptions && languageOptions.upgradeOpenApi && ecosystem === 'cdd-cpp') {
        additionalArgs.push('--upgrade-openapi-3.2.0');
      }

      console.info(`[Worker] Starting WASM generation for ${ecosystem}...`);

      let cliTarget = target || 'to_sdk';
      if (target === 'to_mcp') {
        cliTarget = 'to_sdk_cli';
        if (!additionalArgs.includes('--mcp')) {
          additionalArgs.push('--mcp');
        }
      }

      if (ecosystem === 'cdd-csharp') {
        /** Browser interop methods exposed by Cdd.OpenApi.Cli.BrowserInterop. */
        type CsharpBrowserInterop = {
          /**
           * Invokes C# OpenAPI code generation or extraction.
           * @param a Input specification or source code string.
           * @param b Direction and optional CLI flags ('from_openapi ...' or 'to_openapi').
           * @param c Target subcommand (e.g. 'to_sdk', 'to_openapi', 'to_docs_json').
           * @returns Serialized JSON map of generated files or docs JSON.
           */
          GenerateFromOpenApi: (a: string, b: string, c: string) => string;
        };
        /** Interop exports exposed by the .NET C# WASM assembly. */
        type CsharpExports = {
          /** Optional root-level BrowserInterop export. */
          BrowserInterop?: CsharpBrowserInterop;
          /** Optional root Cdd namespace exported by cdd-csharp.dll. */
          Cdd?: {
            /** OpenApi namespace exported by cdd-csharp.dll. */
            OpenApi: {
              /** Cli namespace exported by cdd-csharp.dll. */
              Cli: {
                /** Namespaced BrowserInterop export. */
                BrowserInterop: CsharpBrowserInterop;
              };
            };
          };
        };
        const globalRef = globalThis as unknown as {
          /** Cached .NET assembly exports. */
          _cddCsharpExports?: CsharpExports;
          /** Singleton initialization promise for the .NET runtime. */
          _cddCsharpInitPromise?: Promise<void>;
        };
        let shouldInitCsharp = false;

        if (!globalRef._cddCsharpInitPromise) {
          shouldInitCsharp = true;
        }

        if (shouldInitCsharp) {
          globalRef._cddCsharpInitPromise = (async (): Promise<void> => {
            console.info(`[Worker] Booting .NET browser-wasm runtime for cdd-csharp...`);
            let dotnetJsUrl = data.payload.cddCsharpDirUrl
              ? data.payload.cddCsharpDirUrl + 'dotnet.js'
              : './assets/wasm/cdd-csharp/dotnet.js';
            if (
              (
                globalRef as {
                  /** Optional override URL for dotnet.js in tests. */
                  _dotnetJsUrl?: string;
                }
              )._dotnetJsUrl
            ) {
              dotnetJsUrl = (
                globalRef as {
                  /** Optional override URL for dotnet.js in tests. */
                  _dotnetJsUrl?: string;
                }
              )._dotnetJsUrl as string;
            }
            const module = await import(/* @vite-ignore */ dotnetJsUrl);
            const { dotnet } = module;
            const { getAssemblyExports, getConfig } = await dotnet
              .withDiagnosticTracing(false)
              .withResourceLoader((_type: string, name: string) => {
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
        const browserInterop = csharpExports.Cdd
          ? csharpExports.Cdd.OpenApi.Cli.BrowserInterop
          : csharpExports.BrowserInterop!;
        const csharpDirection =
          target === 'to_openapi' ? 'to_openapi' : ['from_openapi', ...additionalArgs].join(' ');

        const resultStr = browserInterop.GenerateFromOpenApi(
          finalSpecContent as string,
          csharpDirection,
          cliTarget,
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

      if (
        ecosystem === 'cdd-java' &&
        (target === 'to_docs_json' || target === 'to_openapi') &&
        typeof (
          globalThis as unknown as {
            /** Global GraalVM runtime object. */
            GraalVM?: {
              /** GraalVM run entrypoint. */
              run?: unknown;
            };
          }
        ).GraalVM?.run === 'function'
      ) {
        const javaEngine = new CddJavaBrowserEngine(
          data.payload.cddJavaWasmUrl || './assets/wasm/cdd-java.js.wasm',
        );
        const specStr =
          typeof finalSpecContent === 'string'
            ? finalSpecContent
            : JSON.stringify(finalSpecContent);
        const res =
          target === 'to_docs_json'
            ? await javaEngine.run(['to_docs_json', '-i', 'spec.json', ...additionalArgs], {
                'spec.json': specStr,
              })
            : await javaEngine.run(['to_openapi', '-i', 'Sdk.java'], {
                'Sdk.java': specStr,
              });
        const files = Object.entries(res.files).map(([filePath, content]) => ({
          path: target === 'to_docs_json' ? 'docs.json' : filePath,
          content: new TextEncoder().encode(content),
        }));
        postMessage({ status: 'success', jobId, data: files });
        return;
      }

      let capturedDocsStdout = '';
      if (target === 'to_docs_json') {
        const prefix = `[${ecosystem}] `;
        activeLogCapture = (...args: unknown[]): void => {
          const line = args.map((a) => String(a)).join(' ');
          if (line.startsWith(prefix)) {
            capturedDocsStdout += line.substring(prefix.length) + '\n';
          }
        };
      }

      let generatedFiles: {
        /** Relative file path. */
        path: string;
        /** Binary file content. */
        content: Uint8Array;
      }[];
      try {
        try {
          generatedFiles = await CddWasmSdk.fromOpenApi({
            ecosystem,
            target: cliTarget,
            specContent: finalSpecContent,
            wasmBinary,
            printStdout: true, // Let it print, we've intercepted console
            additionalArgs,
            cddJavaJsUrl: data.payload.cddJavaJsUrl,
            cddJavaWasmUrl: data.payload.cddJavaWasmUrl,
          });
        } catch (sdkErr) {
          if (target === 'to_openapi' && ecosystem === 'cdd-cpp') {
            generatedFiles = extractSchemasToOpenApiFallback(String(finalSpecContent));
          } else {
            throw sdkErr;
          }
        }
      } finally {
        activeLogCapture = null;
      }

      if (target === 'to_openapi' && ecosystem === 'cdd-ts' && generatedFiles.length === 0) {
        generatedFiles = extractSchemasToOpenApiFallback(String(finalSpecContent));
      }

      if (target === 'to_docs_json' && generatedFiles.length === 0) {
        const trimmedStdout = capturedDocsStdout.trim();
        if (
          (trimmedStdout.startsWith('{') && trimmedStdout.endsWith('}')) ||
          (trimmedStdout.startsWith('[') && trimmedStdout.endsWith(']'))
        ) {
          generatedFiles = [
            {
              path: 'docs.json',
              content: new TextEncoder().encode(trimmedStdout),
            },
          ];
        }
      }

      if (target === 'to_docs_json' && generatedFiles.length > 0) {
        const jsonIdx = generatedFiles.findIndex(
          (f) =>
            f.path === 'docs.json' || f.path.endsWith('/docs.json') || f.path.endsWith('.json'),
        );
        if (jsonIdx >= 0) {
          generatedFiles[jsonIdx] = {
            ...generatedFiles[jsonIdx],
            path: 'docs.json',
          };
        }
      }

      if (
        action === 'to_docs_json' &&
        generatedFiles.length > 0 &&
        !languageOptions?.noImports &&
        !languageOptions?.noWrapping
      ) {
        const docsIdx = generatedFiles.findIndex((f) => f.path === 'docs.json');
        if (docsIdx >= 0) {
          const fullStr = new TextDecoder().decode(generatedFiles[docsIdx].content);
          if (!isStructuredDocsJson(fullStr)) {
            const runVariant = async (flags: string[]): Promise<string | undefined> => {
              const varFiles = await CddWasmSdk.fromOpenApi({
                ecosystem,
                target: cliTarget,
                specContent: finalSpecContent,
                wasmBinary,
                printStdout: false,
                additionalArgs: [...additionalArgs, ...flags],
                cddJavaJsUrl: data.payload.cddJavaJsUrl,
                cddJavaWasmUrl: data.payload.cddJavaWasmUrl,
              });
              const vf = varFiles.find(
                (f) => f.path === 'docs.json' || f.path.endsWith('/docs.json'),
              );
              return vf ? new TextDecoder().decode(vf.content) : undefined;
            };
            const [noImports, noWrapping, bare] = await Promise.all([
              runVariant(['--no-imports']),
              runVariant(['--no-wrapping']),
              runVariant(['--no-imports', '--no-wrapping']),
            ]);
            const merged = mergeFlatDocsJsonVariants({
              full: fullStr,
              noImports,
              noWrapping,
              bare,
            });
            generatedFiles[docsIdx] = {
              path: 'docs.json',
              content: new TextEncoder().encode(merged),
            };
          }
        }
      }

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
