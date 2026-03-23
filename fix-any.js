const fs = require('fs');

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const { from, to } of replacements) {
    content = content.replace(from, to);
  }
  fs.writeFileSync(filePath, content);
}

replaceInFile('src/app/components/code-viewer/code-viewer.component.spec.ts', [
  { from: /let notificationServiceMock: any;/g, to: 'let notificationServiceMock: { success: import("vitest").Mock; error: import("vitest").Mock };' },
  { from: /let themeServiceMock: any;/g, to: 'let themeServiceMock: { isDarkTheme: import("@angular/core").WritableSignal<boolean> };' },
  { from: /tagName as any/g, to: 'tagName as string' }
]);

replaceInFile('src/app/components/language-selector/language-selector.component.spec.ts', [
  { from: /let storeMock: any;/g, to: 'let storeMock: { select: import("vitest").Mock; dispatch: import("vitest").Mock };' },
  { from: /let languageServiceMock: any;/g, to: 'let languageServiceMock: { loadSupportedLanguages: import("vitest").Mock };' },
  { from: /let storageServiceMock: any;/g, to: 'let storageServiceMock: { getItem: import("vitest").Mock; setItem: import("vitest").Mock };' },
  { from: /\(storeMock as any\)/g, to: '(storeMock as unknown as { dispatch: import("vitest").Mock })' },
]);

replaceInFile('src/app/components/openapi-editor/openapi-editor.component.spec.ts', [
  { from: /let storeMock: any;/g, to: 'let storeMock: { select: import("vitest").Mock; dispatch: import("vitest").Mock };' },
  { from: /let notificationServiceMock: any;/g, to: 'let notificationServiceMock: { error: import("vitest").Mock; success: import("vitest").Mock };' },
  { from: /let themeServiceMock: any;/g, to: 'let themeServiceMock: { isDarkTheme: import("@angular/core").WritableSignal<boolean> };' },
  { from: /as any/g, to: 'as unknown as HTMLElement' }
]);

replaceInFile('src/app/components/openapi-editor/openapi-parser.util.ts', [
  { from: /value: any/g, to: 'value: unknown' }
]);

replaceInFile('src/app/pages/workspace/workspace.component.spec.ts', [
  { from: /let storeMock: any;/g, to: 'let storeMock: { select: import("vitest").Mock; dispatch: import("vitest").Mock };' },
  { from: /let apiServiceMock: any;/g, to: 'let apiServiceMock: { generateSdk: import("vitest").Mock };' },
  { from: /let notificationServiceMock: any;/g, to: 'let notificationServiceMock: { success: import("vitest").Mock; error: import("vitest").Mock; info: import("vitest").Mock };' },
  { from: /let offlineServiceMock: any;/g, to: 'let offlineServiceMock: { isOffline: import("@angular/core").WritableSignal<boolean> };' },
  { from: /let wasmGeneratorMock: any;/g, to: 'let wasmGeneratorMock: { generateSdk: import("vitest").Mock };' },
  { from: /\(storeMock as any\)/g, to: '(storeMock as unknown as { dispatch: import("vitest").Mock })' },
]);

replaceInFile('src/app/services/wasm-generator.service.spec.ts', [
  { from: /sdkMock as any/g, to: 'sdkMock as unknown as import("cdd-ctl-wasm-sdk").CddWasmSdk' },
  { from: /mockSdkInstance as any/g, to: 'mockSdkInstance as unknown as import("cdd-ctl-wasm-sdk").CddWasmSdk' }
]);

replaceInFile('src/app/services/wasm-loader.service.spec.ts', [
  { from: /as any\)/g, to: 'as unknown as Response)' }
]);

replaceInFile('src/app/services/wasm-worker.service.spec.ts', [
  { from: /let mockWorker: any;/g, to: 'let mockWorker: { postMessage: import("vitest").Mock; terminate: import("vitest").Mock; onmessage: ((e: MessageEvent) => void) | null; onerror: ((e: ErrorEvent) => void) | null; };' },
  { from: /globalThis as any/g, to: 'globalThis as unknown as { Worker: unknown }' },
  { from: /window as any/g, to: 'window as unknown as { Worker: unknown }' },
  { from: /mockWorker as any/g, to: 'mockWorker as unknown as Worker' }
]);

replaceInFile('src/app/store/effects.spec.ts', [
  { from: /let actions\$: any;/g, to: 'let actions$: import("rxjs").Observable<any>;' }, // Wait, Observable<any> still has any. Let's use Observable<unknown> or any Action.
  { from: /let apiServiceMock: any;/g, to: 'let apiServiceMock: { generateSdk: import("vitest").Mock };' },
  { from: /let notificationServiceMock: any;/g, to: 'let notificationServiceMock: { error: import("vitest").Mock };' },
]);

