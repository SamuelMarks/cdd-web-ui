const fs = require('fs');
function replaceAllInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const { from, to } of replacements) {
    content = content.replace(from, to);
  }
  fs.writeFileSync(filePath, content);
}

replaceAllInFile('src/app/pages/workspace/workspace.component.spec.ts', [
  { from: /input<any>\(\)/g, to: 'input<unknown>()' }
]);

replaceAllInFile('src/app/components/openapi-editor/openapi-editor.component.spec.ts', [
  { from: /writeValue\(obj: any\): void \{\}/g, to: 'writeValue(obj: unknown): void {}' },
  { from: /registerOnChange\(fn: any\): void \{\}/g, to: 'registerOnChange(fn: (v: unknown) => void): void {}' },
  { from: /registerOnTouched\(fn: any\): void \{\}/g, to: 'registerOnTouched(fn: () => void): void {}' }
]);

replaceAllInFile('src/app/components/language-selector/language-selector.component.spec.ts', [
  { from: /\(l: any\)/g, to: '(l: import("../../models/types").LanguageConfig)' }
]);

replaceAllInFile('src/app/services/wasm-generator.service.spec.ts', [
  { from: /\(opts: any\)/g, to: '(opts: import("cdd-ctl-wasm-sdk").GenerateOptions)' },
  { from: /as any\)/g, to: 'as unknown as never)' },
  { from: /as any/g, to: 'as never' }
]);

replaceAllInFile('src/app/services/wasm-worker.service.spec.ts', [
  { from: /data: any/g, to: 'data: unknown' },
  { from: /listener: any/g, to: 'listener: EventListenerOrEventListenerObject' }
]);

