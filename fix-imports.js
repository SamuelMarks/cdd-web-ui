const fs = require('fs');
let content = fs.readFileSync('src/app/components/openapi-editor/openapi-editor.component.spec.ts', 'utf8');

content = content.replace("import { MonacoEditorModule } from 'ngx-monaco-editor-v2';\n\n    // Re-override", "    // Re-override");
content = "import { MonacoEditorModule } from 'ngx-monaco-editor-v2';\n" + content;

fs.writeFileSync('src/app/components/openapi-editor/openapi-editor.component.spec.ts', content);
