const fs = require('fs');
let parserContent = fs.readFileSync('src/app/components/openapi-editor/openapi-parser.util.ts', 'utf8');
parserContent = parserContent.replace(/\(e as never\)\.message/g, '(e as Error).message');
fs.writeFileSync('src/app/components/openapi-editor/openapi-parser.util.ts', parserContent);

let workerContent = fs.readFileSync('src/app/services/wasm-worker.service.ts', 'utf8');
workerContent = workerContent.replace(/this\.worker\.addEventListener/g, 'this.worker!.addEventListener');
workerContent = workerContent.replace(/this\.worker\.postMessage/g, 'this.worker!.postMessage');
fs.writeFileSync('src/app/services/wasm-worker.service.ts', workerContent);

