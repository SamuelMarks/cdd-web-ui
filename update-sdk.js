const fs = require('fs');
const file = '../cdd-ctl/cdd-ctl-wasm-sdk/src/index.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/const rootMap = new Map<string, Inode>\(\[\n      \["spec\.json", specFile\]/g, 
  `const isJson = typeof options.specContent === 'string'
      ? options.specContent.trim().startsWith('{')
      : new TextDecoder().decode(options.specContent).trim().startsWith('{');
    const specFileName = isJson ? "spec.json" : "spec.yaml";

    const rootMap = new Map<string, Inode>([
      [specFileName, specFile]`);

code = code.replace(/"\/spec\.json"/g, '`/${specFileName}`');
code = code.replace(/pyodide.FS.writeFile\("\/spec\.json", specContentStr\);/g, 'pyodide.FS.writeFile(`/${specFileName}`, specContentStr);');

fs.writeFileSync(file, code);
