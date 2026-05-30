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
    globalThis.postMessage = postMessageSpy;
  });

  afterEach(() => {
    globalThis.addEventListener = originalAddEventListener;
    globalThis.postMessage = originalPostMessage;
    delete (globalThis as any)._cddCsharpExports;
  });

  it('should handle cdd-csharp target to_docs_json correctly', async () => {
    // Import the worker to register the event listener
    await import('./wasm-worker.worker');

    // Mock csharp exports
    (globalThis as any)._cddCsharpExports = {
      BrowserInterop: {
        GenerateFromOpenApi: vi
          .fn()
          .mockReturnValue('{"endpoints":{"/test":{"get":"client.getTest()"}}}'),
      },
    };

    // Trigger message event
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

    (globalThis as any)._cddCsharpExports = {
      BrowserInterop: {
        GenerateFromOpenApi: vi.fn().mockReturnValue('{"test.cs":"class Test {}"}'),
      },
    };

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
});
