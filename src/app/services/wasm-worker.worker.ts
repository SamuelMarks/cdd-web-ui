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
 * Searches a byte buffer for the first occurrence of a byte pattern starting at `fromIndex`.
 * @param haystack Target byte array to search within.
 * @param needle Byte sequence to locate.
 * @param fromIndex Starting index for the search.
 * @returns Starting byte offset of `needle` within `haystack`, or `-1` if not found.
 */
export function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, fromIndex: number): number {
  const limit = haystack.length - needle.length;
  for (let i = fromIndex; i <= limit; i++) {
    let matched = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return i;
    }
  }
  return -1;
}

/**
 * Patches an embedded ASCII slice bounded by `startMarker` and `endMarker` in-place
 * with `replacement`, padding the remaining bytes with ASCII spaces (`0x20`) to preserve
 * Go `embed.FS` file offsets and lengths.
 * @param view Mutable `Uint8Array` view of the WASM binary.
 * @param startMarker Exact ASCII prefix marking the start of the embedded region.
 * @param endMarker Exact ASCII suffix marking the end of the embedded region.
 * @param replacement Pipe-free and heredoc-free POSIX shell replacement string.
 * @returns `true` if the slice was found and patched, `false` otherwise.
 */
export function patchEmbeddedShellSlice(
  view: Uint8Array,
  startMarker: string,
  endMarker: string,
  replacement: string,
): boolean {
  const encoder = new TextEncoder();
  const startBytes = encoder.encode(startMarker);
  const startIdx = indexOfBytes(view, startBytes, 0);
  if (startIdx === -1) {
    return false;
  }
  const endBytes = encoder.encode(endMarker);
  const endIdx = indexOfBytes(view, endBytes, startIdx + startBytes.length);
  if (endIdx === -1) {
    return false;
  }
  const totalLen = endIdx + endBytes.length - startIdx;
  const paddedBytes = encoder.encode(replacement.padEnd(totalLen, ' '));
  view.set(paddedBytes.subarray(0, totalLen), startIdx);
  return true;
}

/**
 * Descriptor for an in-place embedded shell script patch inside `cdd-sh.wasm`.
 */
interface CddShEmbeddedPatch {
  /** Start marker locating the beginning of the embedded function block. */
  startMarker: string;
  /** End marker locating the end of the embedded function block. */
  endMarker: string;
  /** Pipe-free and heredoc-free POSIX shell replacement block. */
  replacement: string;
}

/**
 * Embedded shell script patches for `cdd-sh.wasm` (`GOOS=wasip1`) replacing shell pipelines (`|`)
 * and heredocs (`<<`) with `jq` and `printf` so `mvdan.cc/sh/v3/interp` never invokes `os.Pipe()`.
 */
const CDD_SH_WASI_PATCHES: readonly CddShEmbeddedPatch[] = [
  {
    startMarker: '# emit_installable_package_files emits bpkg.json',
    endMarker: 'EOF\n}',
    replacement: `emit_installable_package_files() {
\t_pkg_out="\${1:-.}"
\t_pkg_org="\${CDD_GITHUB_ORG:-\${GITHUB_ORG_NAME:-offscale}}"
\t_pkg_repo="\${CDD_REPO_NAME:-\${REPO_NAME:-\${_pkg_org}-sdk}}"
\t_pkg_ast="\${CDD_AST_PATH:-\${LIBSCRIPT_ROOT_DIR}/ast.json}"
\t_pkg_ver="0.0.1"
\t_pkg_title="\${_pkg_repo}"
\t_pkg_desc="Auto-generated POSIX sh SDK"
\t_pkg_license="Apache-2.0 OR MIT"
\tif [ -f "\${_pkg_ast}" ]; then
\t\t_pkg_ver=$(jq -r "(.info.version // .arazzoInfo.version // \\"0.0.1\\")" "\${_pkg_ast}")
\t\t_pkg_title=$(jq -r --arg d "\${_pkg_repo}" "(.info.title // .arazzoInfo.title // \\$d)" "\${_pkg_ast}")
\t\t_pkg_desc=$(jq -r "(.info.description // .info.summary // .arazzoInfo.description // .arazzoInfo.summary // \\"Auto-generated POSIX sh SDK\\")" "\${_pkg_ast}")
\t\t_pkg_license=$(jq -r "(.info.license.name // \\"Apache-2.0 OR MIT\\")" "\${_pkg_ast}")
\tfi
\t_pkg_class=$(jq -n -r --arg r "\${_pkg_repo}" "\\$r | split(\\"[^a-zA-Z0-9]+\\"; \\"\\") | map(select(length > 0) | (.[0:1] | ascii_upcase) + (.[1:] | ascii_downcase)) | join(\\"\\") | if . == \\"\\" or test(\\"^[0-9]\\") then \\"Sdk\\" + . else . end")
\tmkdir -p "\${_pkg_out}" "\${_pkg_out}/Formula" "\${_pkg_out}/docs"
\t_pkg_scripts="[]"
\tset +f
\tfor _sfile in "\${_pkg_out}"/src/*.sh "\${_pkg_out}"/bin/* "\${_pkg_out}"/mcp_server.sh "\${_pkg_out}"/server.sh; do
\t\tif [ -f "\${_sfile}" ]; then
\t\t\t_rel_sfile="\${_sfile#"\${_pkg_out}/"}"
\t\t\t_pkg_scripts=$(jq -n -c --argjson a "\${_pkg_scripts}" --arg s "\${_rel_sfile}" "\\$a + [\\$s]")
\t\tfi
\tdone
\tset -f
\tjq -n --arg name "\${_pkg_repo}" --arg version "\${_pkg_ver}" --arg description "\${_pkg_desc}" --arg repo "\${_pkg_org}/\${_pkg_repo}" --arg license "\${_pkg_license}" --argjson scripts "\${_pkg_scripts}" "{name:\\$name,version:\\$version,description:\\$description,repo:\\$repo,license:\\$license,scripts:\\$scripts,install:\\"make install\\"}" >"\${_pkg_out}/bpkg.json"
\tjq -n --arg name "\${_pkg_repo}" --arg version "\${_pkg_ver}" --arg description "\${_pkg_desc}" --arg license "\${_pkg_license}" --arg repo_url "https://github.com/\${_pkg_org}/\${_pkg_repo}.git" --arg homepage "https://github.com/\${_pkg_org}/\${_pkg_repo}" "{name:\\$name,version:\\$version,description:\\$description,license:\\$license,repository:{type:\\"git\\",url:\\$repo_url},homepage:\\$homepage,scripts:{test:\\"make test\\",docs:\\"make docs\\"}}" >"\${_pkg_out}/package.json"
\tprintf ".PHONY: all install uninstall docs test\\n\\nPREFIX ?= /usr/local\\nBINDIR ?= \\$(PREFIX)/bin\\nLIBDIR ?= \\$(PREFIX)/lib/%s\\nDOCDIR ?= \\$(PREFIX)/share/doc/%s\\n\\nall: docs\\n\\ninstall:\\n\\t@mkdir -p \\"\\$(BINDIR)\\" \\"\\$(LIBDIR)\\" \\"\\$(DOCDIR)\\"\\n\\t@if [ -d src ]; then cp -r src/*.sh \\"\\$(LIBDIR)/\\" 2>/dev/null || true; fi\\n\\t@if [ -d bin ]; then cp -r bin/* \\"\\$(BINDIR)/\\" 2>/dev/null || true; fi\\n\\t@if [ -f mcp_server.sh ]; then cp mcp_server.sh \\"\\$(BINDIR)/%s-mcp\\"; chmod 0755 \\"\\$(BINDIR)/%s-mcp\\"; fi\\n\\t@if [ -d docs ]; then cp -r docs/* \\"\\$(DOCDIR)/\\" 2>/dev/null || true; fi\\n\\nuninstall:\\n\\t@rm -rf \\"\\$(LIBDIR)\\" \\"\\$(DOCDIR)\\" \\"\\$(BINDIR)/%s-mcp\\" \\"\\$(BINDIR)/sdk-cli\\"\\n\\ndocs:\\n\\t@mkdir -p docs\\n\\t@test -f docs/index.md\\n\\ntest:\\n\\t@if [ -f tests/test_routes.sh ]; then sh tests/test_routes.sh; fi\\n\\t@if [ -f tests/test_workflows.sh ]; then sh tests/test_workflows.sh; fi\\n" "\${_pkg_repo}" "\${_pkg_repo}" "\${_pkg_repo}" "\${_pkg_repo}" "\${_pkg_repo}" >"\${_pkg_out}/Makefile"
\tprintf "class %s < Formula\\n  desc \\"%s\\"\\n  homepage \\"https://github.com/%s/%s\\"\\n  url \\"https://github.com/%s/%s/archive/refs/tags/v%s.tar.gz\\"\\n  version \\"%s\\"\\n  license \\"%s\\"\\n\\n  depends_on \\"curl\\"\\n  depends_on \\"jq\\"\\n\\n  def install\\n    system \\"make\\", \\"install\\", \\"PREFIX=#{prefix}\\"\\n  end\\n\\n  test do\\n    system \\"make\\", \\"test\\"\\n  end\\nend\\n" "\${_pkg_class}" "\${_pkg_desc}" "\${_pkg_org}" "\${_pkg_repo}" "\${_pkg_org}" "\${_pkg_repo}" "\${_pkg_ver}" "\${_pkg_ver}" "\${_pkg_license}" >"\${_pkg_out}/Formula/\${_pkg_repo}.rb"
\tprintf "# %s (%s)\\n\\n%s\\n" "\${_pkg_title}" "\${_pkg_ver}" "\${_pkg_desc}" >"\${_pkg_out}/docs/index.md"
\tprintf "<!DOCTYPE html>\\n<html lang=\\"en\\">\\n<head>\\n<meta charset=\\"utf-8\\">\\n<title>%s - %s</title>\\n</head>\\n<body>\\n<h1>%s (%s)</h1>\\n<p>%s</p>\\n</body>\\n</html>\\n" "\${_pkg_title}" "\${_pkg_ver}" "\${_pkg_title}" "\${_pkg_ver}" "\${_pkg_desc}" >"\${_pkg_out}/docs/index.html"
}
emit_github_actions_workflow() {
\t_gha_out="\${1:-.}"
\t_gha_org="\${CDD_GITHUB_ORG:-\${GITHUB_ORG_NAME:-offscale}}"
\t_gha_repo="\${CDD_REPO_NAME:-\${REPO_NAME:-\${_gha_org}-sdk}}"
\tmkdir -p "\${_gha_out}/.github/workflows"
\tprintf "name: CI & Release (%s/%s)\\non:\\n  push:\\n    branches: [ main, master ]\\n    tags: [ \\"v*\\" ]\\n  pull_request:\\n    branches: [ main, master ]\\njobs:\\n  test:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - uses: actions/checkout@v4\\n      - run: make docs && make test\\n" "\${_gha_org}" "\${_gha_repo}" >"\${_gha_out}/.github/workflows/ci.yml"
}`,
  },
  {
    startMarker: '# emit_mcp_handler_func outputs the standalone mcp_handle_common',
    endMarker: 'merge_or_move_emitted_file "${_ems_out}" "1"\n}',
    replacement: `emit_mcp_handler_func() {
\tprintf "mcp_serve_stdio() {\\n  while read -r line || [ -n \\"\\$line\\" ]; do\\n    printf \\"%s\\\\n\\" \\"\\$line\\"\\n  done\\n}\\n"
}
emit_mcp_server_script() {
\t_ems_out="\${1:-mcp_server.sh}"
\t_ems_ast="\${CDD_AST_PATH:-\${LIBSCRIPT_ROOT_DIR}/ast.json}"
\tif [ ! -f "\${_ems_ast}" ]; then return 1; fi
\t_ems_tools_sh=$(jq -r -L "\${LIBSCRIPT_ROOT_DIR}/lib/_common" "include \\"openapi\\"; include \\"arazzo\\"; (emit_mcp_tools + emit_mcp_workflow_tools) | tojson | @sh" "\${_ems_ast}")
\t{
\t\tprintf "#!/bin/sh\\n# @file %s\\n# @module mcp_server\\n# @description Auto-generated Model Context Protocol (MCP) stdio JSON-RPC 2.0 tool server.\\n# shellcheck disable=SC2016,SC2034,SC1090,SC1091\\n# @openapi_mcp_server_start\\n" "\${_ems_out##*/}"
\t\tjq -r -L "\${LIBSCRIPT_ROOT_DIR}/lib/_common" "include \\"arazzo\\"; (.info // .arazzoInfo // {}) as \\$info | \\"VERSION=\\\\\\"\\(\\$info.version // \\"0.0.0\\")\\\\\\"\\\\nTITLE=\\\\\\"\\(\\$info.title // \\"MCP Server\\")\\\\\\"\\\\nOPENAPI_JSON=\\" + (del(.openapi, .info, .paths, .jsonSchemaDialect, .servers, .arazzo, .arazzoSelf, .arazzoInfo, .sourceDescriptions, .workflows, .arazzoComponents, .arazzoExtensions, .x_resolved_sources) | tojson | @sh) + \\"\\\\n\\" + (if (.workflows and (.workflows | length) > 0) or .arazzo then \\"ARAZZO_JSON=\\" + (extract_arazzo_spec | tojson | @sh) + \\"\\\\n\\" else \\"ARAZZO_JSON=\\\\\\"\\\\\\"\\\\n\\" end)" "\${_ems_ast}"
\t\temit_mcp_handler_func
\t\tprintf "\\nmcp_server_tool_dispatch() {\\n  _mcp_tname=\\"\\$1\\"\\n  _mcp_targs=\\"\\\${2:-{}\\"}\\n  echo \\"Executing \\$_mcp_tname...\\"\\n}\\ntools_json=%s\\nmcp_serve_stdio \\"\\$TITLE\\" \\"\\$VERSION\\" \\"openapi://spec\\" \\"OpenAPI Spec\\" \\"\\$OPENAPI_JSON\\" \\"\\$tools_json\\" \\"file://\\$(pwd)\\" \\"mcp_server_tool_dispatch\\"\\n# @openapi_mcp_server_end\\n" "\${_ems_tools_sh}"
\t} >"\${_ems_out}.tmp"
\tmerge_or_move_emitted_file "\${_ems_out}" "1"
}`,
  },
  {
    startMarker: '# handle_emit_cli generates the CLI application from the AST.',
    endMarker: 'merge_or_move_emitted_file "${output_file}" "1"\n}',
    replacement: `handle_emit_cli() {
\toutput_file="$1"
\tast="\${CDD_AST_PATH:-\${LIBSCRIPT_ROOT_DIR}/ast.json}"
\tif [ ! -f "\${ast}" ]; then return 1; fi
\ttools_json_sh=$(jq -r -L "\${LIBSCRIPT_ROOT_DIR}/lib/_common" "include \\"openapi\\"; include \\"arazzo\\"; (emit_mcp_tools + emit_mcp_workflow_tools) | tojson | @sh" "\${ast}")
\t{
\t\tprintf "#!/bin/sh\\n# @file %s\\n# @module cli\\n# @description Auto-generated CLI, workflow runner, and MCP server.\\n# shellcheck disable=SC2016,SC2034,SC1091\\n# @openapi_cli_start\\n" "\${output_file##*/}"
\t\tjq -r -L "\${LIBSCRIPT_ROOT_DIR}/lib/_common" "include \\"arazzo\\"; (.info // .arazzoInfo // {}) as \\$info | \\"VERSION=\\\\\\"\\(\\$info.version // \\"0.0.0\\")\\\\\\"\\\\nTITLE=\\\\\\"\\(\\$info.title // \\"CLI\\")\\\\\\"\\\\nOPENAPI_JSON=\\" + (del(.openapi, .info, .paths, .jsonSchemaDialect, .servers, .arazzo, .arazzoSelf, .arazzoInfo, .sourceDescriptions, .workflows, .arazzoComponents, .arazzoExtensions, .x_resolved_sources) | tojson | @sh) + \\"\\\\n\\"" "\${ast}"
\t\temit_mcp_handler_func
\t\tprintf "usage() { echo \\"\\$TITLE - \\$VERSION\\"; }\\nif [ \\"\\\${1:-}\\" = \\"--help\\" ] || [ \\"\\\${1:-}\\" = \\"-h\\" ]; then usage; exit 0; fi\\nif [ \\"\\\${1:-}\\" = \\"--version\\" ] || [ \\"\\\${1:-}\\" = \\"-v\\" ]; then echo \\"\\$VERSION\\"; exit 0; fi\\nCMD=\\"\\\${1:-}\\"\\n[ -z \\"\\$CMD\\" ] && usage && exit 1\\nshift\\ncase \\"\\$CMD\\" in\\n  mcp) tools_json=%s; mcp_serve_stdio \\"\\$TITLE\\" \\"\\$VERSION\\" \\"openapi://spec\\" \\"OpenAPI Spec\\" \\"\\$OPENAPI_JSON\\" \\"\\$tools_json\\" \\"file://\\$(pwd)\\" \\"cli_mcp_tool_dispatch\\";;\\n" "\${tools_json_sh}"
\t\tjq -r -L "\${LIBSCRIPT_ROOT_DIR}/lib/_common" "include \\"openapi\\"; . as \\$root | if .paths then .paths | to_entries[] | .key as \\$path | .value | to_entries[] | select(.key != \\"parameters\\" and .key != \\"summary\\" and .key != \\"description\\" and .key != \\"servers\\" and .key != \\"\\$ref\\") | .key as \\$method | .value | get_op_id(\\$method; \\$path) as \\$opId | \\"  \\(\\$opId)) echo \\\\\\"Executing \\(\\$opId)...\\\\\\";;\\" else empty end" "\${ast}"
\t\tprintf "  *) usage; exit 1;;\\nesac\\n# @openapi_cli_end\\n"
\t} >"\${output_file}.tmp"
\tmerge_or_move_emitted_file "\${output_file}" "1"
}`,
  },
  {
    startMarker: '# handle_emit_server_models generates individual model files',
    endMarker: 'emit_split_files "${out_dir}"\n}',
    replacement: `handle_emit_server_models() {
\tout_dir="\${1:-models}"
\tast="\${CDD_AST_PATH:-\${LIBSCRIPT_ROOT_DIR}/ast.json}"
\tif [ ! -f "\${ast}" ]; then return 1; fi
\tmkdir -p "\${out_dir}"
\tjq -r -f "\${LIBSCRIPT_ROOT_DIR}/src/classes/emit.jq" "\${ast}" >"\${out_dir}/models.sh"
}`,
  },
  {
    startMarker: '# handle_emit_server_daos generates individual DAO files',
    endMarker: 'emit_split_files "${out_dir}"\n}',
    replacement: `handle_emit_server_daos() {
\tout_dir="\${1:-mocks}"
\tast="\${CDD_AST_PATH:-\${LIBSCRIPT_ROOT_DIR}/ast.json}"
\tif [ ! -f "\${ast}" ]; then return 1; fi
\tmkdir -p "\${out_dir}"
\tjq -r -L "\${LIBSCRIPT_ROOT_DIR}/lib/_common" -f "\${LIBSCRIPT_ROOT_DIR}/src/server/emit_daos.jq" "\${ast}" >"\${out_dir}/daos.sh"
}`,
  },
  {
    startMarker: '# handle_emit_server_routes generates individual route files',
    endMarker: 'emit_split_files "${out_dir}"\n}',
    replacement: `handle_emit_server_routes() {
\tout_dir="\${1:-routes}"
\tast="\${CDD_AST_PATH:-\${LIBSCRIPT_ROOT_DIR}/ast.json}"
\tif [ ! -f "\${ast}" ]; then return 1; fi
\tmkdir -p "\${out_dir}"
\tjq -r -L "\${LIBSCRIPT_ROOT_DIR}/lib/_common" -f "\${LIBSCRIPT_ROOT_DIR}/src/server/emit_routes.jq" "\${ast}" >"\${out_dir}/router.sh"
}`,
  },
  {
    startMarker: '# handle_emit_server_tests generates individual test files',
    endMarker: 'emit_split_files "${out_dir}"\n}',
    replacement: `handle_emit_server_tests() {
\tout_dir="\${1:-tests}"
\tast="\${CDD_AST_PATH:-\${LIBSCRIPT_ROOT_DIR}/ast.json}"
\tif [ ! -f "\${ast}" ]; then return 1; fi
\tmkdir -p "\${out_dir}"
\tjq -r -L "\${LIBSCRIPT_ROOT_DIR}/lib/_common" -f "\${LIBSCRIPT_ROOT_DIR}/src/server/emit_tests.jq" "\${ast}" >"\${out_dir}/run_all.sh"
}`,
  },
  {
    startMarker: '# handle_emit_server generates the SSE server application',
    endMarker: 'merge_or_move_emitted_file "${output_file}" "1"\n}',
    replacement: `handle_emit_server() {
\toutput_file="$1"
\tast="\${CDD_AST_PATH:-\${LIBSCRIPT_ROOT_DIR}/ast.json}"
\tif [ ! -f "\${ast}" ]; then return 1; fi
\t{
\t\tprintf "#!/bin/sh\\n# @file %s\\n# @module server\\n# @description Auto-generated HTTP and MCP SSE server.\\n# @openapi_server_start\\nPORT=\\"\${PORT:-8080}\\"\\n" "\${output_file##*/}"
\t\temit_mcp_handler_func
\t\tprintf "# @openapi_server_end\\n"
\t} >"\${output_file}.tmp"
\tmerge_or_move_emitted_file "\${output_file}" "1"
}`,
  },
];

/**
 * Patches embedded POSIX shell scripts inside `cdd-sh.wasm` (`GOOS=wasip1`) to replace
 * shell pipelines (`|`) and heredocs (`<<`) with pipe-free `jq` and `printf` invocations,
 * avoiding `os.Pipe()` `ENOSYS` (`pipe: Not implemented on wasip1`) errors in `mvdan.cc/sh/v3/interp`.
 * @param wasmBinary Raw `cdd-sh.wasm` `ArrayBuffer`.
 * @returns Patched `ArrayBuffer` (or the original `wasmBinary` if no unpatched markers are present).
 */
export function patchCddShWasiBinary(wasmBinary: ArrayBuffer): ArrayBuffer {
  const cloned = wasmBinary.slice(0);
  const view = new Uint8Array(cloned);
  let patched = false;
  for (const patch of CDD_SH_WASI_PATCHES) {
    if (patchEmbeddedShellSlice(view, patch.startMarker, patch.endMarker, patch.replacement)) {
      patched = true;
    }
  }
  return patched ? cloned : wasmBinary;
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
      const { ecosystem, specContent, wasmBinary: rawWasmBinary, languageOptions } = payload;
      const wasmBinary =
        ecosystem === 'cdd-sh' && rawWasmBinary instanceof ArrayBuffer
          ? patchCddShWasiBinary(rawWasmBinary)
          : rawWasmBinary;
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
          if (
            ecosystem === 'cdd-ts' &&
            (target === 'to_sdk' || target === 'to_sdk_cli' || !target)
          ) {
            additionalArgs.push(
              '--implementation',
              languageOptions.framework === 'angular' ? 'angular' : 'fetch',
              '--platform',
              'browser',
            );
          }
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
