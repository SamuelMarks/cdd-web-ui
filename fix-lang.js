const fs = require('fs');
let content = fs.readFileSync('src/app/services/language.service.ts', 'utf8');

content = content.replace(
"  { id: 'typescript', name: 'TypeScript', repo: 'cdd-ts', availableInWasm: true, selectedByDefault: true, iconUrl: '/assets/icons/typescript.svg' },",
"  { id: 'typescript', name: 'TypeScript', repo: 'cdd-ts', availableInWasm: true, selectedByDefault: true, iconUrl: '/assets/icons/typescript.svg' },\n  { id: 'openapi', name: 'OpenAPI 3.2.0', repo: 'cdd-cpp', availableInWasm: true, selectedByDefault: false, iconUrl: '/assets/icons/openapi.svg' },"
);

fs.writeFileSync('src/app/services/language.service.ts', content);
