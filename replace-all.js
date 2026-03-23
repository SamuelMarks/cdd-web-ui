const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.ts');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Generic replacement for mocked services
  content = content.replace(/let\s+([a-zA-Z0-9_]+Mock)\s*:\s*any\s*;/g, 'let $1: Record<string, import("vitest").Mock>;');
  content = content.replace(/let\s+([a-zA-Z0-9_]+Service)\s*:\s*any\s*;/g, 'let $1: Record<string, import("vitest").Mock>;');
  content = content.replace(/let\s+mock([a-zA-Z0-9_]+)\s*:\s*any\s*;/g, 'let mock$1: Record<string, import("vitest").Mock>;');
  
  content = content.replace(/\(storeMock as any\)/g, '(storeMock as unknown as Record<string, import("vitest").Mock>)');
  content = content.replace(/as any/g, 'as never'); // `as never` or `as unknown`
  
  content = content.replace(/value: any/g, 'value: unknown');
  content = content.replace(/let actions\$: any;/g, 'let actions$: import("rxjs").Observable<import("@ngrx/store").Action>;');

  // specific to wasm-generator
  content = content.replace(/sdkMock: any/g, 'sdkMock: unknown');

  if (content !== original) {
    fs.writeFileSync(file, content);
  }
}
