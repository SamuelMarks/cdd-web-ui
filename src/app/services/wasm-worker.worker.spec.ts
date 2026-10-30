import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll test the message handler by intercepting addEventListener
describe('wasm-worker.worker.ts', () => {
  it('should handle to_mcp target without adding --mcp if already present', async () => {
    const { CddWasmSdk } = await import('cdd-browser-sdk');
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockResolvedValue([]);
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'mcp-job-2',
        payload: {
          ecosystem: 'cdd-ts',
          specContent: '{}',
          target: 'to_mcp',
          languageOptions: {
            mcp: true,
          },
        },
      },
    });
    const mockCall = vi
      .mocked(CddWasmSdk.fromOpenApi)
      .mock.calls.find((c) => c[0].ecosystem === 'cdd-ts' && c[0].target === 'to_sdk_cli');
    expect(mockCall).toBeDefined();
    expect(mockCall![0].additionalArgs?.filter((a) => a === '--mcp').length).toBe(1);
  });

  it('should handle to_mcp target correctly by setting --mcp and to_sdk_cli', async () => {
    const { CddWasmSdk } = await import('cdd-browser-sdk');
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockResolvedValue([]);
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'mcp-job',
        payload: {
          ecosystem: 'cdd-ts',
          specContent: '{}',
          target: 'to_mcp',
          languageOptions: {},
        },
      },
    });
    const mockCall = vi
      .mocked(CddWasmSdk.fromOpenApi)
      .mock.calls.find((c) => c[0].ecosystem === 'cdd-ts' && c[0].target === 'to_sdk_cli');
    expect(mockCall).toBeDefined();
    expect(mockCall![0].additionalArgs).toContain('--mcp');
  });

  let messageHandler: (...args: unknown[]) => unknown;
  let originalAddEventListener: unknown;
  let postMessageSpy: import('vitest').Mock;

  beforeEach(() => {
    vi.resetModules();
    originalAddEventListener = globalThis.addEventListener;
    globalThis.addEventListener = (event: string, handler: (...args: unknown[]) => unknown) => {
      if (event === 'message') {
        messageHandler = handler;
      }
    };

    postMessageSpy = vi.fn();
    vi.stubGlobal('postMessage', postMessageSpy);
  });

  afterEach(() => {
    globalThis.addEventListener = originalAddEventListener;
    vi.unstubAllGlobals();
    delete (globalThis as unknown as Record<string, unknown>)._cddCsharpExports;
    delete (globalThis as unknown as Record<string, unknown>)._cddCsharpInitPromise;
    vi.restoreAllMocks();
  });

  it('should handle cdd-csharp target to_docs_json correctly', async () => {
    await import('./wasm-worker.worker');
    vi.stubGlobal('_cddCsharpExports', {
      BrowserInterop: {
        GenerateFromOpenApi: vi
          .fn()
          .mockReturnValue('{"endpoints":{"/test":{"get":"client.getTest()"}}}'),
      },
    });
    vi.stubGlobal('_cddCsharpInitPromise', Promise.resolve());

    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: '123',
        payload: {
          ecosystem: 'cdd-csharp',
          specContent: '{}',
          target: 'to_docs_json',
          languageOptions: {},
        },
      },
    });

    expect(postMessageSpy).toHaveBeenCalled();
    const successCall = postMessageSpy.mock.calls.find(
      (call: [Record<string, unknown>]) => call[0].status === 'success',
    );
    expect(successCall).toBeDefined();
    expect(successCall[0].data.length).toBe(1);
    expect(successCall[0].data[0].path).toBe('docs.json');
    const content = new TextDecoder().decode(successCall[0].data[0].content);
    expect(content).toContain('"endpoints"');
  });

  it('should use cddCsharpDirUrl if provided in payload', async () => {
    delete (globalThis as unknown as Record<string, unknown>)._dotnetJsUrl;
    vi.stubGlobal('_cddCsharpExports', null);
    vi.stubGlobal('_cddCsharpInitPromise', null);

    // Provide a mocked dotnet.js via dynamic import by setting cddCsharpDirUrl to a data URL
    const mockDotnet =
      "export const dotnet = { withDiagnosticTracing: () => ({ withResourceLoader: (loader) => { return { create: async () => ({ getConfig: () => ({ mainAssemblyName: 'test' }), getAssemblyExports: async () => ({ BrowserInterop: { GenerateFromOpenApi: () => '{}' } }) }) }; } }) };";
    const dirUrl =
      'data:text/javascript;base64,' + Buffer.from(mockDotnet).toString('base64') + '#';

    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        payload: {
          ecosystem: 'cdd-csharp',
          target: 'to_sdk',
          specContent: '{}',
          cddCsharpDirUrl: dirUrl,
        },
        jobId: 'csharp-job',
      },
    });

    const successCall = postMessageSpy.mock.calls.find(
      (call) => call[0].status === 'success' && call[0].jobId === 'csharp-job',
    );
    expect(successCall).toBeDefined();
  });

  it('should use custom _dotnetJsUrl if provided', async () => {
    (globalThis as unknown as Record<string, unknown>)._dotnetJsUrl = 'custom-dotnet.js';
    vi.stubGlobal('_cddCsharpExports', null);
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'csharp-url-job',
        payload: {
          ecosystem: 'cdd-csharp',
          specContent: '{}',
          target: 'to_sdk',
          languageOptions: {},
        },
      },
    });
    delete (globalThis as unknown as Record<string, unknown>)._dotnetJsUrl;
  });

  it('should handle cdd-csharp target to_sdk correctly', async () => {
    await import('./wasm-worker.worker');
    const generateSpy = vi.fn().mockReturnValue('{"test.cs":"class Test {}"}');
    vi.stubGlobal('_cddCsharpExports', {
      Cdd: {
        OpenApi: {
          Cli: {
            BrowserInterop: {
              GenerateFromOpenApi: generateSpy,
            },
          },
        },
      },
    });
    vi.stubGlobal('_cddCsharpInitPromise', Promise.resolve());

    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: '124',
        payload: {
          ecosystem: 'cdd-csharp',
          specContent: '{}',
          target: 'to_sdk',
          languageOptions: { tests: true },
        },
      },
    });
    expect(generateSpy).toHaveBeenCalledWith('{}', 'from_openapi --tests', 'to_sdk');

    const successCall = postMessageSpy.mock.calls.find(
      (call: [Record<string, unknown>]) => call[0].status === 'success' && call[0].jobId === '124',
    );
    expect(successCall).toBeDefined();
    expect(successCall[0].data.length).toBe(1);
    expect(successCall[0].data[0].path).toBe('test.cs');
  });

  it('should handle string parsed from YAML', async () => {
    const { CddWasmSdk } = await import('cdd-browser-sdk');
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockResolvedValue([]);
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'yaml-string-job',
        payload: {
          ecosystem: 'cdd-ts',
          specContent: '"just a string"',
          target: 'to_sdk',
          languageOptions: {},
        },
      },
    });
  });

  it('should parse YAML spec correctly', async () => {
    await import('./wasm-worker.worker');
    const { CddWasmSdk } = await import('cdd-browser-sdk');
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockResolvedValue([
      { path: 'test.ts', content: new Uint8Array() },
    ]);
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'yaml-job',
        payload: {
          ecosystem: 'cdd-ts',
          specContent: 'openapi: 3.0.0\ninfo:\n  title: Test',
          target: 'to_sdk',
        },
      },
    });
    const mockCall = vi
      .mocked(CddWasmSdk.fromOpenApi)
      .mock.calls.find((c: [Record<string, unknown>]) => c[0].ecosystem === 'cdd-ts');
    if (mockCall) expect(mockCall[0].specContent).toContain('"openapi": "3.0.0"');
  });

  it('should pass correct languageOptions to CddWasmSdk', async () => {
    await import('./wasm-worker.worker');
    const { CddWasmSdk } = await import('cdd-browser-sdk');
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockResolvedValue([]);
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'lang-opt-job',
        payload: {
          ecosystem: 'cdd-cpp',
          specContent: '{}',
          target: 'to_sdk',
          languageOptions: {
            autoAdmin: true,
            framework: 'express',
            serverFramework: 'express',
            orm: 'typeorm',
            noGithubActions: true,
            noInstallablePackage: true,
            tests: true,
            mcp: true,
            withEphemeral: true,
            withSeed: true,
            noGenerateServices: true,
            noTestGen: true,
            noImports: true,
            noWrapping: true,
            upgradeOpenApi: true,
          },
        },
      },
    });
    const mockCall = vi
      .mocked(CddWasmSdk.fromOpenApi)
      .mock.calls.find((c: [Record<string, unknown>]) => c[0].ecosystem === 'cdd-cpp');
    if (mockCall) {
      const args = mockCall[0].additionalArgs;
      expect(args).toContain('--admin');
      expect(args).toContain('--framework');
      expect(args).toContain('express');
      expect(args).toContain('--serverFramework');
      expect(args).toContain('--orm');
      expect(args).toContain('typeorm');
      expect(args).toContain('--no-github-actions');
      expect(args).toContain('--no-installable-package');
      expect(args).toContain('--tests');
      expect(args).toContain('--mcp');
      expect(args).toContain('--with-ephemeral');
      expect(args).toContain('--with-seed');
      expect(args).toContain('--no-generate-services');
      expect(args).toContain('--no-test-gen');
      expect(args).toContain('--no-imports');
      expect(args).toContain('--no-wrapping');
      expect(args).toContain('--upgrade-openapi-3.2.0');
    }
  });

  it('should handle unknown action', async () => {
    await import('./wasm-worker.worker');
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({ data: { action: 'unknownAction', jobId: 'err-job', payload: {} } });
    const errorCall = postMessageSpy.mock.calls.find(
      (call: [Record<string, unknown>]) =>
        call[0].status === 'error' && call[0].jobId === 'err-job',
    );
    expect(errorCall).toBeDefined();
    expect(errorCall[0].error).toContain('Unknown action');
  });

  it('should intercept console logs', async () => {
    await import('./wasm-worker.worker');
    console.log('test log');
    console.warn('test warn');
    console.error('test error');

    expect(postMessageSpy).toHaveBeenCalledWith({
      status: 'log',
      level: 'INFO',
      message: 'test log',
    });
    expect(postMessageSpy).toHaveBeenCalledWith({
      status: 'log',
      level: 'WARN',
      message: 'test warn',
    });
    expect(postMessageSpy).toHaveBeenCalledWith({
      status: 'log',
      level: 'ERROR',
      message: 'test error',
    });
  });

  it('should catch YAML parse error and fallback to string', async () => {
    await import('./wasm-worker.worker');
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: '126',
        payload: {
          ecosystem: 'cdd-ts',
          specContent: 'openapi: 3.0.0\ninfo: \n  title: "unclosed string',
          target: 'to_sdk',
        },
      },
    });
    expect(postMessageSpy).toHaveBeenCalled();
  });

  it('should not set shouldLoadJava if GraalVM is defined', async () => {
    (globalThis as unknown as Record<string, unknown>).self = { GraalVM: {} };
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'graalvm-defined-job',
        payload: {
          ecosystem: 'cdd-java',
          specContent: '{}',
          target: 'to_sdk',
          languageOptions: {},
        },
      },
    });
    delete (globalThis as unknown as Record<string, unknown>).self;
  });

  it('should handle GraalVM when self is undefined', async () => {
    delete (globalThis as unknown as Record<string, unknown>).GraalVM;
    const oldSelf = globalThis.self;
    (globalThis as unknown as Record<string, unknown>).self = undefined;
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'branch-1',
        payload: { ecosystem: 'cdd-java', specContent: '{}' },
      },
    });
    (globalThis as unknown as Record<string, unknown>).self = oldSelf;
  });

  it('should catch error when setting GraalVM on globalThis', async () => {
    delete (globalThis as unknown as Record<string, unknown>).GraalVM;
    Object.defineProperty(globalThis, 'GraalVM', {
      get: () => undefined,
      set: () => {
        throw new Error('Cannot set GraalVM');
      },
      configurable: true,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () =>
        Promise.resolve(
          'var GraalVM = {}; Object.defineProperty(self, "GraalVM", { get: () => ({}) });',
        ),
    } as unknown as Response);
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'branch-2',
        payload: { ecosystem: 'cdd-java', specContent: '{}' },
      },
    });
    fetchSpy.mockRestore();
    delete (globalThis as unknown as Record<string, unknown>).GraalVM;
  });

  it('should not parse yaml if specContent is already an object', async () => {
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'branch-3',
        payload: { ecosystem: 'cdd-ts', specContent: { openapi: '3.0.0' }, target: 'to_sdk' },
      },
    });
    expect(postMessageSpy).toHaveBeenCalled();
  });

  it('should catch error in main handler and post error message', async () => {
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({ data: { action: 'generateSdk', payload: null, jobId: 'err-1' } });
    const errorCall = postMessageSpy.mock.calls.find(
      (call: [Record<string, unknown>]) => call[0].status === 'error',
    );
    expect(errorCall).toBeDefined();

    const { CddWasmSdk } = await import('cdd-browser-sdk');
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockRejectedValueOnce('string error');
    await handleMessage({
      data: {
        action: 'generateSdk',
        payload: { ecosystem: 'cdd-ts', specContent: '{}', target: 'to_sdk' },
        jobId: 'err-2',
      },
    } as unknown as MessageEvent);
    const nonErrCall = postMessageSpy.mock.calls.find(
      (call: [Record<string, unknown>]) =>
        call[0].status === 'error' && call[0].error === 'string error',
    );
    expect(nonErrCall).toBeDefined();
  });

  it('should handle fetch error for cdd-java.js gracefully', async () => {
    await import('./wasm-worker.worker');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Fetch failed'));
    if (typeof globalThis.self === 'undefined') {
      (globalThis as unknown as Record<string, unknown>).self = globalThis;
    }
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: '128',
        payload: { ecosystem: 'cdd-java', specContent: '{}' },
      },
    });
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('should attempt to boot C# runtime and handle errors gracefully', async () => {
    delete (globalThis as unknown as Record<string, unknown>)._cddCsharpInitPromise;
    delete (globalThis as unknown as Record<string, unknown>)._cddCsharpExports;
    const mockDotnet =
      "export const dotnet = { withDiagnosticTracing: () => ({ withResourceLoader: (loader) => { loader('type', 'name'); loader('type', 'http://example.com/name'); return { create: async () => ({ getConfig: () => ({ mainAssemblyName: 'test' }), getAssemblyExports: async () => ({ BrowserInterop: { GenerateFromOpenApi: () => '{}' } }) }) }; } }) };";
    (globalThis as unknown as Record<string, unknown>)._dotnetJsUrl =
      'data:text/javascript;base64,' + Buffer.from(mockDotnet).toString('base64');
    await import('./wasm-worker.worker');
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'csharp-boot',
        payload: { ecosystem: 'cdd-csharp', specContent: '{}' },
      },
    });
    const errorCall = postMessageSpy.mock.calls.find(
      (call: [Record<string, unknown>]) =>
        call[0].status === 'success' && call[0].jobId === 'csharp-boot',
    );
    expect(errorCall).toBeDefined();
    delete (globalThis as unknown as Record<string, unknown>)._dotnetJsUrl;
  });

  it('should handle cdd-csharp error from BrowserInterop', async () => {
    await import('./wasm-worker.worker');
    vi.stubGlobal('_cddCsharpExports', {
      BrowserInterop: { GenerateFromOpenApi: vi.fn().mockReturnValue('{"error":"Test C# Error"}') },
    });
    vi.stubGlobal('_cddCsharpInitPromise', Promise.resolve());
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'csharp-err',
        payload: { ecosystem: 'cdd-csharp', specContent: '{}', target: 'to_sdk' },
      },
    });
    const errorCall = postMessageSpy.mock.calls.find(
      (call: [Record<string, unknown>]) =>
        call[0].status === 'error' && call[0].jobId === 'csharp-err',
    );
    expect(errorCall).toBeDefined();
    expect(errorCall[0].error).toContain('Test C# Error');
  });

  it('should successfully execute globalEval and copy GraalVM', async () => {
    delete (globalThis as unknown as Record<string, unknown>).GraalVM;

    // Ensure self is globalThis
    if (typeof globalThis.self === 'undefined') {
      (globalThis as unknown as Record<string, unknown>).self = globalThis;
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () => Promise.resolve('self.GraalVM = { copied: true };'),
    } as unknown as Response);

    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'branch-4',
        payload: { ecosystem: 'cdd-java', specContent: '{}' },
      },
    });

    expect((globalThis as unknown as Record<string, unknown>).GraalVM).toEqual({ copied: true });
    fetchSpy.mockRestore();
    delete (globalThis as unknown as Record<string, unknown>).GraalVM;
  });

  it('should handle cdd-csharp without target, defaulting to to_sdk', async () => {
    await import('./wasm-worker.worker');
    vi.stubGlobal('_cddCsharpExports', {
      BrowserInterop: {
        GenerateFromOpenApi: vi.fn().mockReturnValue('{"test2.cs":"class Test2 {}"}'),
      },
    });
    vi.stubGlobal('_cddCsharpInitPromise', Promise.resolve());
    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'csharp-default',
        payload: { ecosystem: 'cdd-csharp', specContent: '{}' },
      },
    });
    const successCall = postMessageSpy.mock.calls.find(
      (call: [Record<string, unknown>]) =>
        call[0].status === 'success' && call[0].jobId === 'csharp-default',
    );
    expect(successCall).toBeDefined();
    expect(successCall[0].data[0].path).toBe('test2.cs');
  });

  it('should handle missing GraalVM after eval', async () => {
    delete (globalThis as unknown as Record<string, unknown>).GraalVM;
    if (typeof globalThis.self === 'undefined') {
      (globalThis as unknown as Record<string, unknown>).self = globalThis;
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () => Promise.resolve('var nothing = true;'),
    } as unknown as Response);

    const { handleMessage } = await import('./wasm-worker.worker');
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'branch-5',
        payload: { ecosystem: 'cdd-java', specContent: '{}' },
      },
    });

    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('should execute CddJavaBrowserEngine methods and handle GraalVM run branches', async () => {
    const { CddJavaBrowserEngine, handleMessage } = await import('./wasm-worker.worker');
    const engineDefault = new CddJavaBrowserEngine();

    delete (globalThis as unknown as Record<string, unknown>).GraalVM;
    await expect(engineDefault.run(['to_sdk'])).rejects.toThrow('GraalVM runtime is not loaded.');

    // Queue recovery after rejected run + Config branch + success response
    let capturedArgs: string[] = [];
    let capturedConfig: { wasm_path?: string } | undefined;
    class MockConfig {
      wasm_path?: string;
    }
    (globalThis as unknown as Record<string, unknown>).GraalVM = {
      Config: MockConfig,
      run: (args: string[], cfg?: { wasm_path?: string }): Promise<void> => {
        capturedArgs = args;
        capturedConfig = cfg;
        console.log(
          'CDD_IN_MEMORY_START\n' +
            JSON.stringify({ success: true, files: { 'Sdk.java': 'public class Sdk {}' } }) +
            '\nCDD_IN_MEMORY_END',
        );
        return Promise.resolve();
      },
    };

    const sdkRes = await engineDefault.generateSdk('{}', true, true, true);
    expect(sdkRes.files['Sdk.java']).toBe('public class Sdk {}');
    expect(capturedConfig?.wasm_path).toBe('./assets/wasm/cdd-java.js.wasm');
    expect(capturedArgs[0]).toBe('process_in_memory');

    const sdkCliRes = await engineDefault.generateSdkCli('{}', true, true, true);
    expect(sdkCliRes.files['Sdk.java']).toBe('public class Sdk {}');

    const sdkCliDefaultsRes = await engineDefault.generateSdkCli('{}');
    expect(sdkCliDefaultsRes.files['Sdk.java']).toBe('public class Sdk {}');

    const serverRes = await engineDefault.generateServer('{}');
    expect(serverRes.files['Sdk.java']).toBe('public class Sdk {}');

    const ormRes = await engineDefault.generateOrm('{}');
    expect(ormRes.files['Sdk.java']).toBe('public class Sdk {}');

    const defaultRunRes = await engineDefault.run(['from_openapi']);
    expect(defaultRunRes.files['Sdk.java']).toBe('public class Sdk {}');

    // Empty files fallback when parsed.files is undefined
    (globalThis as unknown as Record<string, unknown>).GraalVM = {
      run: (): Promise<void> => {
        console.info('CDD_IN_MEMORY_START\n{"success":true}\nCDD_IN_MEMORY_END');
        return Promise.resolve();
      },
    };
    const emptyFilesRes = await engineDefault.generateSdk('{}');
    expect(emptyFilesRes.files).toEqual({});

    // Error response with explicit error message and fallback Unknown error
    (globalThis as unknown as Record<string, unknown>).GraalVM = {
      run: (): Promise<void> => {
        console.log('CDD_IN_MEMORY_START\n{"success":false,"error":"Bad spec"}\nCDD_IN_MEMORY_END');
        return Promise.resolve();
      },
    };
    await expect(engineDefault.generateSdk('{}')).rejects.toThrow(
      'cdd-java execution error: Bad spec',
    );

    (globalThis as unknown as Record<string, unknown>).GraalVM = {
      run: (): Promise<void> => {
        console.log('CDD_IN_MEMORY_START\n{"success":false}\nCDD_IN_MEMORY_END');
        return Promise.resolve();
      },
    };
    await expect(engineDefault.generateSdk('{}')).rejects.toThrow(
      'cdd-java execution error: Unknown error',
    );

    // Missing markers response
    (globalThis as unknown as Record<string, unknown>).GraalVM = {
      run: (): Promise<void> => {
        console.log('no markers here');
        return Promise.resolve();
      },
    };
    await expect(engineDefault.generateSdk('{}')).rejects.toThrow(
      'cdd-java did not return a valid in-memory response.',
    );

    // Handle to_docs_json and to_openapi via handleMessage when GraalVM.run is a function
    (globalThis as unknown as Record<string, unknown>).GraalVM = {
      run: (): Promise<void> => {
        console.log(
          'CDD_IN_MEMORY_START\n' +
            JSON.stringify({ success: true, files: { 'spec.json': '{"openapi":"3.2.0"}' } }) +
            '\nCDD_IN_MEMORY_END',
        );
        return Promise.resolve();
      },
    };

    postMessageSpy.mockClear();
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'java-docs-json',
        payload: {
          ecosystem: 'cdd-java',
          specContent: { openapi: '3.2.0' },
          target: 'to_docs_json',
          cddJavaWasmUrl: 'http://localhost/cdd-java.js.wasm',
        },
      },
    } as unknown as MessageEvent);
    expect(
      postMessageSpy.mock.calls.find(
        (c: [Record<string, unknown>]) =>
          c[0].status === 'success' && c[0].jobId === 'java-docs-json',
      ),
    ).toBeDefined();

    postMessageSpy.mockClear();
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'java-to-openapi',
        payload: {
          ecosystem: 'cdd-java',
          specContent: 'public class Sdk {}',
          target: 'to_openapi',
        },
      },
    } as unknown as MessageEvent);
    expect(
      postMessageSpy.mock.calls.find(
        (c: [Record<string, unknown>]) =>
          c[0].status === 'success' && c[0].jobId === 'java-to-openapi',
      ),
    ).toBeDefined();

    delete (globalThis as unknown as Record<string, unknown>).GraalVM;
  });

  it('should cover the message event listener', () => {
    if (messageHandler) {
      messageHandler({ data: {} });
    }
  });

  it('should fallback to extractSchemasToOpenApiFallback when cdd-cpp to_openapi throws or cdd-ts to_openapi returns empty', async () => {
    const { CddWasmSdk } = await import('cdd-browser-sdk');
    const { handleMessage, extractSchemasToOpenApiFallback } = await import('./wasm-worker.worker');

    const directFallback = extractSchemasToOpenApiFallback(
      'export interface Pet { id: number; }\nstruct Order { int id; };',
    );
    expect(directFallback.length).toBe(1);
    expect(directFallback[0].path).toBe('openapi.json');
    expect(new TextDecoder().decode(directFallback[0].content)).toContain('"Pet"');

    // cdd-cpp to_openapi throws -> fallback succeeds
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockRejectedValueOnce(new Error('Not a directory'));
    postMessageSpy.mockClear();
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'cpp-to-openapi-fallback',
        payload: {
          ecosystem: 'cdd-cpp',
          specContent: 'struct Pet { int id; };',
          target: 'to_openapi',
        },
      },
    } as unknown as MessageEvent);
    const cppSuccess = postMessageSpy.mock.calls.find(
      (c: [Record<string, unknown>]) =>
        c[0].status === 'success' && c[0].jobId === 'cpp-to-openapi-fallback',
    );
    expect(cppSuccess).toBeDefined();

    // cdd-ts to_openapi returns [] -> fallback succeeds
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockResolvedValueOnce([]);
    postMessageSpy.mockClear();
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'ts-to-openapi-fallback',
        payload: {
          ecosystem: 'cdd-ts',
          specContent: 'export interface Pet { id: number; }',
          target: 'to_openapi',
        },
      },
    } as unknown as MessageEvent);
    const tsSuccess = postMessageSpy.mock.calls.find(
      (c: [Record<string, unknown>]) =>
        c[0].status === 'success' && c[0].jobId === 'ts-to-openapi-fallback',
    );
    expect(tsSuccess).toBeDefined();
  });

  it('should capture stdout JSON when target is to_docs_json and no files are written to /out', async () => {
    const { CddWasmSdk } = await import('cdd-browser-sdk');
    const { handleMessage } = await import('./wasm-worker.worker');

    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockImplementationOnce(() => {
      console.log('[other-eco] ignored line');
      console.log('[cdd-c] {');
      console.log('[cdd-c]   "endpoints": { "/pet": { "get": "int main(void) { return 0; }" } }');
      console.log('[cdd-c] }');
      return Promise.resolve([]);
    });

    postMessageSpy.mockClear();
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'c-docs-stdout',
        payload: {
          ecosystem: 'cdd-c',
          specContent: '{"openapi":"3.2.0"}',
          target: 'to_docs_json',
        },
      },
    } as unknown as MessageEvent);

    const successCall = postMessageSpy.mock.calls.find(
      (c: [Record<string, unknown>]) => c[0].status === 'success' && c[0].jobId === 'c-docs-stdout',
    );
    expect(successCall).toBeDefined();
    const files = (successCall?.[0] as { data: { path: string; content: Uint8Array }[] }).data;
    expect(files.length).toBe(1);
    expect(files[0].path).toBe('docs.json');
    expect(new TextDecoder().decode(files[0].content)).toContain('"endpoints"');

    // JSON array stdout branch when generatedFiles is empty
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockImplementationOnce(() => {
      console.log('[cdd-c] [{"endpoints": {}}]');
      return Promise.resolve([]);
    });
    postMessageSpy.mockClear();
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'c-docs-array',
        payload: {
          ecosystem: 'cdd-c',
          specContent: '{"openapi":"3.2.0"}',
          target: 'to_docs_json',
        },
      },
    } as unknown as MessageEvent);
    const arrayCall = postMessageSpy.mock.calls.find(
      (c: [Record<string, unknown>]) => c[0].status === 'success' && c[0].jobId === 'c-docs-array',
    );
    expect((arrayCall?.[0] as { data: unknown[] }).data.length).toBe(1);

    // Non-JSON stdout fallback branch when generatedFiles is empty
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockImplementationOnce(() => {
      console.log('[cdd-c] plain text output');
      return Promise.resolve([]);
    });
    postMessageSpy.mockClear();
    await handleMessage({
      data: {
        action: 'generateSdk',
        jobId: 'c-docs-nonjson',
        payload: {
          ecosystem: 'cdd-c',
          specContent: '{"openapi":"3.2.0"}',
          target: 'to_docs_json',
        },
      },
    } as unknown as MessageEvent);
    const nonJsonCall = postMessageSpy.mock.calls.find(
      (c: [Record<string, unknown>]) =>
        c[0].status === 'success' && c[0].jobId === 'c-docs-nonjson',
    );
    expect((nonJsonCall?.[0] as { data: unknown[] }).data).toEqual([]);
  });

  describe('All 13 cdd-${LANGUAGE} compilers (from_openapi and to_openapi)', () => {
    const ALL_ECOSYSTEMS = [
      'cdd-c',
      'cdd-cpp',
      'cdd-csharp',
      'cdd-go',
      'cdd-java',
      'cdd-kotlin',
      'cdd-php',
      'cdd-python-all',
      'cdd-ruby',
      'cdd-rust',
      'cdd-sh',
      'cdd-swift',
      'cdd-ts',
    ] as const;

    const ALL_TARGETS = [
      'to_sdk',
      'to_sdk_cli',
      'to_mcp',
      'to_server',
      'to_orm',
      'to_openapi_3_2_0',
      'to_docs_json',
      'to_openapi',
    ] as const;

    for (const ecosystem of ALL_ECOSYSTEMS) {
      it(`should execute ${ecosystem} across all targets including from_openapi and to_openapi without error`, async () => {
        const { CddWasmSdk } = await import('cdd-browser-sdk');
        const encoder = new TextEncoder();
        vi.spyOn(CddWasmSdk, 'fromOpenApi').mockResolvedValue([
          {
            path: 'openapi.json',
            content: encoder.encode(
              '{"openapi":"3.2.0","info":{"title":"Test","version":"1.0.0"},"paths":{}}',
            ),
          },
        ]);

        vi.stubGlobal('_cddCsharpExports', {
          Cdd: {
            OpenApi: {
              Cli: {
                BrowserInterop: {
                  GenerateFromOpenApi: vi
                    .fn()
                    .mockImplementation((_spec: string, direction: string) => {
                      if (direction === 'to_openapi') {
                        return JSON.stringify({
                          'openapi.json':
                            '{"openapi":"3.2.0","info":{"title":"CSharp","version":"1.0.0"},"paths":{}}',
                        });
                      }
                      return JSON.stringify({
                        'Client.cs': 'namespace Sdk { public class Client {} }',
                      });
                    }),
                },
              },
            },
          },
        });
        vi.stubGlobal('_cddCsharpInitPromise', Promise.resolve());
        (globalThis as unknown as Record<string, unknown>).GraalVM = { ready: true };

        const { handleMessage } = await import('./wasm-worker.worker');

        for (const target of ALL_TARGETS) {
          postMessageSpy.mockClear();
          const jobId = `${ecosystem}-${target}`;
          await handleMessage({
            data: {
              action: 'generateSdk',
              jobId,
              payload: {
                ecosystem,
                specContent:
                  target === 'to_openapi'
                    ? '// source code input'
                    : '{"openapi":"3.2.0","info":{"title":"API","version":"1.0.0"},"paths":{}}',
                target,
                languageOptions: {
                  framework: 'angular',
                  serverFramework: 'express',
                  orm: 'typeorm',
                  autoAdmin: true,
                  noGithubActions: false,
                  noInstallablePackage: false,
                  tests: true,
                  mcp: true,
                  withEphemeral: true,
                  withSeed: true,
                  noGenerateServices: false,
                },
                wasmBinary: new ArrayBuffer(8),
              },
            },
          } as unknown as MessageEvent);

          const errorCall = postMessageSpy.mock.calls.find(
            (call: [Record<string, unknown>]) =>
              call[0].status === 'error' && call[0].jobId === jobId,
          );
          expect(errorCall).toBeUndefined();

          const successCall = postMessageSpy.mock.calls.find(
            (call: [Record<string, unknown>]) =>
              call[0].status === 'success' && call[0].jobId === jobId,
          );
          expect(successCall).toBeDefined();
          expect(Array.isArray(successCall![0].data)).toBe(true);
          expect(successCall![0].data.length).toBeGreaterThan(0);
          if (target === 'to_docs_json') {
            expect(successCall![0].data[0].path).toBe('docs.json');
          }
        }

        delete (globalThis as unknown as Record<string, unknown>).GraalVM;
      });
    }

    it('should execute dedicated to_docs_json action across all 13 ecosystems and support both structured and 4-variant flat docs.json', async () => {
      const { CddWasmSdk } = await import('cdd-browser-sdk');
      const { handleMessage, isStructuredDocsJson, mergeFlatDocsJsonVariants } =
        await import('./wasm-worker.worker');

      // Direct unit tests for isStructuredDocsJson and mergeFlatDocsJsonVariants branches
      expect(isStructuredDocsJson('invalid json')).toBe(false);
      expect(isStructuredDocsJson('null')).toBe(false);
      expect(isStructuredDocsJson('{"endpoints":null}')).toBe(false);
      expect(isStructuredDocsJson('{"endpoints":{"/a":null}}')).toBe(false);
      expect(isStructuredDocsJson('{"endpoints":{"/a":{"get":"flat"}}}')).toBe(false);
      expect(
        isStructuredDocsJson('[{"endpoints":{"/a":{"get":{"imports":"i","snippet":"s"}}}}]'),
      ).toBe(true);
      expect(
        isStructuredDocsJson(
          '{"operations":[{"path":"/a","method":"GET","code":{"snippet":"s"}}]}',
        ),
      ).toBe(true);
      expect(
        isStructuredDocsJson(
          '[{"language":"cpp","operations":[{"code":{"imports":"#include <iostream>","wrapper_start":"int main() {","snippet":"call();","wrapper_end":"}"}}]}]',
        ),
      ).toBe(true);
      expect(
        isStructuredDocsJson('{"operations":["not-an-obj",{"path":"/a","code":"flat"}]}'),
      ).toBe(false);

      expect(mergeFlatDocsJsonVariants({ full: 'invalid' })).toBe('invalid');
      expect(mergeFlatDocsJsonVariants({ full: '123' })).toBe('123');
      expect(mergeFlatDocsJsonVariants({ full: '{"other":1}' })).toBe('{"other":1}');
      expect(
        mergeFlatDocsJsonVariants({
          full: '[{"endpoints":{"/p":{"get":{"snippet":"already"},"post":null},"bad":null}}]',
        }),
      ).toContain('"snippet":"already"');
      // Fallback import detection via full vs noImports when bare is not found in noWrapping, and when noImp is not at index > 0
      const mergedFallbackImports = mergeFlatDocsJsonVariants({
        full: '{"endpoints":{"/p":{"get":"import x;\\nmain() { call(); }","post":"call();"}}}',
        noImports: '{"endpoints":{"/p":{"get":"main() { call(); }","post":"call();"}}}',
        noWrapping: '{"endpoints":{"/p":{"get":"unrelated","post":"unrelated"}}}',
        bare: '{"endpoints":{"/p":{"get":"","post":""}}}',
      });
      expect(JSON.parse(mergedFallbackImports).endpoints['/p'].get.imports).toBe('import x;');
      expect(JSON.parse(mergedFallbackImports).endpoints['/p'].post.imports).toBe('');

      const postMessageSpy = vi.fn();
      vi.stubGlobal('postMessage', postMessageSpy);

      for (const ecosystem of ALL_ECOSYSTEMS) {
        if (ecosystem === 'cdd-csharp' || ecosystem === 'cdd-java') continue;

        // 1. Flat-string compiler output -> triggers 4-variant synthesis
        vi.spyOn(CddWasmSdk, 'fromOpenApi').mockImplementation(
          (opts: { additionalArgs?: string[] }) => {
            const args = opts.additionalArgs || [];
            const noImp = args.includes('--no-imports');
            const noWrap = args.includes('--no-wrapping');
            let code = 'import pkg;\nfunc main() {\n  client.getPet();\n}';
            if (noImp && noWrap) code = 'client.getPet();';
            else if (noImp) code = 'func main() {\n  client.getPet();\n}';
            else if (noWrap) code = 'import pkg;\nclient.getPet();';
            return Promise.resolve([
              {
                path: 'out/docs.json',
                content: new TextEncoder().encode(
                  JSON.stringify({ endpoints: { '/pet': { get: code } } }),
                ),
              },
            ]);
          },
        );

        postMessageSpy.mockClear();
        await handleMessage({
          data: {
            action: 'to_docs_json',
            jobId: `docs-flat-${ecosystem}`,
            payload: {
              ecosystem,
              specContent: '{"openapi":"3.2.0","info":{"title":"T","version":"1"},"paths":{}}',
              ...(ecosystem === 'cdd-ts' ? { framework: 'react' } : {}),
            },
          },
        } as unknown as MessageEvent);

        const flatSuccess = postMessageSpy.mock.calls.find(
          (c: [Record<string, unknown>]) =>
            c[0].status === 'success' && c[0].jobId === `docs-flat-${ecosystem}`,
        );
        expect(flatSuccess).toBeDefined();
        const decodedFlat = new TextDecoder().decode(
          (flatSuccess![0].data as { path: string; content: Uint8Array }[])[0].content,
        );
        expect(isStructuredDocsJson(decodedFlat)).toBe(true);

        // 2. Structured compiler output -> single invocation without extra variant calls
        const structuredSpy = vi
          .spyOn(CddWasmSdk, 'fromOpenApi')
          .mockClear()
          .mockResolvedValueOnce([
            {
              path: 'docs.json',
              content: new TextEncoder().encode(
                JSON.stringify({
                  endpoints: {
                    '/pet': {
                      get: {
                        imports: 'import a;',
                        wrapper_start: 'fn main() {',
                        snippet: 'call();',
                        wrapper_end: '}',
                      },
                    },
                  },
                }),
              ),
            },
          ]);

        postMessageSpy.mockClear();
        await handleMessage({
          data: {
            action: 'to_docs_json',
            jobId: `docs-struct-${ecosystem}`,
            payload: {
              ecosystem,
              specContent: '{"openapi":"3.2.0","info":{"title":"T","version":"1"},"paths":{}}',
            },
          },
        } as unknown as MessageEvent);
        expect(structuredSpy).toHaveBeenCalledTimes(1);

        // 3. Variant returning no docs.json file, and initial call returning non-docs.json file
        vi.spyOn(CddWasmSdk, 'fromOpenApi')
          .mockResolvedValueOnce([
            {
              path: 'docs.json',
              content: new TextEncoder().encode('{"endpoints":{"/pet":{"get":"call()"}}}'),
            },
          ])
          .mockResolvedValue([]);
        await handleMessage({
          data: {
            action: 'to_docs_json',
            jobId: `docs-empty-var-${ecosystem}`,
            payload: {
              ecosystem,
              specContent: '{"openapi":"3.2.0","info":{"title":"T","version":"1"},"paths":{}}',
            },
          },
        } as unknown as MessageEvent);

        vi.spyOn(CddWasmSdk, 'fromOpenApi').mockResolvedValueOnce([
          {
            path: 'README.md',
            content: new TextEncoder().encode('# readme'),
          },
        ]);
        await handleMessage({
          data: {
            action: 'to_docs_json',
            jobId: `docs-no-docs-file-${ecosystem}`,
            payload: {
              ecosystem,
              specContent: '{"openapi":"3.2.0","info":{"title":"T","version":"1"},"paths":{}}',
            },
          },
        } as unknown as MessageEvent);
      }
    });
  });
});
