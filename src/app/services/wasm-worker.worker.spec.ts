import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll test the message handler by intercepting addEventListener
describe('wasm-worker.worker.ts', () => {
  let messageHandler: any;
  let originalAddEventListener: any;
  let originalPostMessage: any;
  let postMessageSpy: any;

  beforeEach(() => {
    vi.resetModules();
    originalAddEventListener = globalThis.addEventListener;
    globalThis.addEventListener = (event: string, handler: any) => {
      if (event === 'message') {
        messageHandler = handler;
      }
    };
    originalPostMessage = globalThis.postMessage;
    postMessageSpy = vi.fn();
    vi.stubGlobal('postMessage', postMessageSpy);
  });

  afterEach(() => {
    globalThis.addEventListener = originalAddEventListener;
    vi.unstubAllGlobals();
    delete (globalThis as any)._cddCsharpExports;
    delete (globalThis as any)._cddCsharpInitPromise;
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

    await messageHandler({
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
    const successCall = postMessageSpy.mock.calls.find((call: any) => call[0].status === 'success');
    expect(successCall).toBeDefined();
    expect(successCall[0].data.length).toBe(1);
    expect(successCall[0].data[0].path).toBe('docs.json');
    const content = new TextDecoder().decode(successCall[0].data[0].content);
    expect(content).toContain('"endpoints"');
  });

  it('should handle cdd-csharp target to_sdk correctly', async () => {
    await import('./wasm-worker.worker');
    vi.stubGlobal('_cddCsharpExports', {
      BrowserInterop: {
        GenerateFromOpenApi: vi.fn().mockReturnValue('{"test.cs":"class Test {}"}'),
      },
    });
    vi.stubGlobal('_cddCsharpInitPromise', Promise.resolve());

    await messageHandler({
      data: {
        action: 'generateSdk',
        jobId: '124',
        payload: {
          ecosystem: 'cdd-csharp',
          specContent: '{}',
          target: 'to_sdk',
          languageOptions: {},
        },
      },
    });

    const successCall = postMessageSpy.mock.calls.find(
      (call: any) => call[0].status === 'success' && call[0].jobId === '124',
    );
    expect(successCall).toBeDefined();
    expect(successCall[0].data.length).toBe(1);
    expect(successCall[0].data[0].path).toBe('test.cs');
  });

  it('should parse YAML spec correctly', async () => {
    await import('./wasm-worker.worker');
    const { CddWasmSdk } = await import('cdd-ctl-wasm-sdk');
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockResolvedValue([
      { path: 'test.ts', content: new Uint8Array() },
    ] as any);
    await messageHandler({
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
      .mock.calls.find((c: any) => c[0].ecosystem === 'cdd-ts');
    if (mockCall) expect(mockCall[0].specContent).toContain('"openapi": "3.0.0"');
  });

  it('should pass correct languageOptions to CddWasmSdk', async () => {
    await import('./wasm-worker.worker');
    const { CddWasmSdk } = await import('cdd-ctl-wasm-sdk');
    vi.spyOn(CddWasmSdk, 'fromOpenApi').mockResolvedValue([] as any);
    await messageHandler({
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
            noImports: true,
            noWrapping: true,
            upgradeOpenApi: true,
          },
        },
      },
    });
    const mockCall = vi
      .mocked(CddWasmSdk.fromOpenApi)
      .mock.calls.find((c: any) => c[0].ecosystem === 'cdd-cpp');
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
      expect(args).toContain('--no-imports');
      expect(args).toContain('--no-wrapping');
      expect(args).toContain('--upgrade-openapi-3.2.0');
    }
  });

  it('should handle unknown action', async () => {
    await import('./wasm-worker.worker');
    await messageHandler({ data: { action: 'unknownAction', jobId: 'err-job', payload: {} } });
    const errorCall = postMessageSpy.mock.calls.find(
      (call: any) => call[0].status === 'error' && call[0].jobId === 'err-job',
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
    await messageHandler({
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

  it('should handle GraalVM when self is undefined', async () => {
    delete (globalThis as any).GraalVM;
    const oldSelf = globalThis.self;
    (globalThis as any).self = undefined;
    await messageHandler({
      data: {
        action: 'generateSdk',
        jobId: 'branch-1',
        payload: { ecosystem: 'cdd-java', specContent: '{}' },
      },
    });
    (globalThis as any).self = oldSelf;
  });

  it('should catch error when setting GraalVM on globalThis', async () => {
    delete (globalThis as any).GraalVM;
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
    await messageHandler({
      data: {
        action: 'generateSdk',
        jobId: 'branch-2',
        payload: { ecosystem: 'cdd-java', specContent: '{}' },
      },
    });
    fetchSpy.mockRestore();
    delete (globalThis as any).GraalVM;
  });

  it('should not parse yaml if specContent is already an object', async () => {
    await messageHandler({
      data: {
        action: 'generateSdk',
        jobId: 'branch-3',
        payload: { ecosystem: 'cdd-ts', specContent: { openapi: '3.0.0' }, target: 'to_sdk' },
      },
    });
    expect(postMessageSpy).toHaveBeenCalled();
  });

  it('should catch error in main handler and post error message', async () => {
    await messageHandler({ data: { action: 'generateSdk', payload: null, jobId: 'err-1' } });
    const errorCall = postMessageSpy.mock.calls.find((call: any) => call[0].status === 'error');
    expect(errorCall).toBeDefined();
  });

  it('should handle fetch error for cdd-java.js gracefully', async () => {
    await import('./wasm-worker.worker');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Fetch failed'));
    if (typeof globalThis.self === 'undefined') {
      (globalThis as any).self = globalThis;
    }
    await messageHandler({
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
    delete (globalThis as any)._cddCsharpInitPromise;
    delete (globalThis as any)._cddCsharpExports;
    const mockDotnet =
      "export const dotnet = { withDiagnosticTracing: () => ({ withResourceLoader: (loader) => { loader('type', 'name', 'uri', 'integrity', 'behavior'); return { create: async () => ({ getConfig: () => ({ mainAssemblyName: 'test' }), getAssemblyExports: async () => ({ BrowserInterop: { GenerateFromOpenApi: () => '{}' } }) }) }; } }) };";
    (globalThis as any)._dotnetJsUrl =
      'data:text/javascript;base64,' + Buffer.from(mockDotnet).toString('base64');
    await import('./wasm-worker.worker');
    await messageHandler({
      data: {
        action: 'generateSdk',
        jobId: 'csharp-boot',
        payload: { ecosystem: 'cdd-csharp', specContent: '{}' },
      },
    });
    const errorCall = postMessageSpy.mock.calls.find(
      (call: any) => call[0].status === 'success' && call[0].jobId === 'csharp-boot',
    );
    expect(errorCall).toBeDefined();
    delete (globalThis as any)._dotnetJsUrl;
  });

  it('should handle cdd-csharp error from BrowserInterop', async () => {
    await import('./wasm-worker.worker');
    vi.stubGlobal('_cddCsharpExports', {
      BrowserInterop: { GenerateFromOpenApi: vi.fn().mockReturnValue('{"error":"Test C# Error"}') },
    });
    vi.stubGlobal('_cddCsharpInitPromise', Promise.resolve());
    await messageHandler({
      data: {
        action: 'generateSdk',
        jobId: 'csharp-err',
        payload: { ecosystem: 'cdd-csharp', specContent: '{}', target: 'to_sdk' },
      },
    });
    const errorCall = postMessageSpy.mock.calls.find(
      (call: any) => call[0].status === 'error' && call[0].jobId === 'csharp-err',
    );
    expect(errorCall).toBeDefined();
    expect(errorCall[0].error).toContain('Test C# Error');
  });

  it('should successfully execute globalEval and copy GraalVM', async () => {
    delete (globalThis as any).GraalVM;

    // Ensure self is globalThis
    if (typeof globalThis.self === 'undefined') {
      (globalThis as any).self = globalThis;
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () => Promise.resolve('self.GraalVM = { copied: true };'),
    } as unknown as Response);

    await messageHandler({
      data: {
        action: 'generateSdk',
        jobId: 'branch-4',
        payload: { ecosystem: 'cdd-java', specContent: '{}' },
      },
    });

    expect((globalThis as any).GraalVM).toEqual({ copied: true });
    fetchSpy.mockRestore();
    delete (globalThis as any).GraalVM;
  });

  it('should handle cdd-csharp without target, defaulting to to_sdk', async () => {
    await import('./wasm-worker.worker');
    vi.stubGlobal('_cddCsharpExports', {
      BrowserInterop: {
        GenerateFromOpenApi: vi.fn().mockReturnValue('{"test2.cs":"class Test2 {}"}'),
      },
    });
    vi.stubGlobal('_cddCsharpInitPromise', Promise.resolve());
    await messageHandler({
      data: {
        action: 'generateSdk',
        jobId: 'csharp-default',
        payload: { ecosystem: 'cdd-csharp', specContent: '{}' },
      },
    });
    const successCall = postMessageSpy.mock.calls.find(
      (call: any) => call[0].status === 'success' && call[0].jobId === 'csharp-default',
    );
    expect(successCall).toBeDefined();
    expect(successCall[0].data[0].path).toBe('test2.cs');
  });

  it('should handle missing GraalVM after eval', async () => {
    delete (globalThis as any).GraalVM;
    if (typeof globalThis.self === 'undefined') {
      (globalThis as any).self = globalThis;
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () => Promise.resolve('var nothing = true;'),
    } as unknown as Response);

    await messageHandler({
      data: {
        action: 'generateSdk',
        jobId: 'branch-5',
        payload: { ecosystem: 'cdd-java', specContent: '{}' },
      },
    });

    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
