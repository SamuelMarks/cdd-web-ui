const fs = require('fs');
let content = fs.readFileSync('src/app/components/openapi-editor/openapi-editor.component.spec.ts', 'utf8');

content = content.replace(
/TestBed\.overrideComponent\(OpenApiEditorComponent, {\n\s*set: {\n\s*imports: \[\n\s*MockMonacoEditorComponent,\s*FormsModule,\s*import\('@angular\/common'\)\.then\(m => m\.CommonModule\),\s*import\('@angular\/material\/select'\)\.then\(m => m\.MatSelectModule\),\s*import\('@angular\/material\/form-field'\)\.then\(m => m\.MatFormFieldModule\),\s*import\('@angular\/material\/button'\)\.then\(m => m\.MatButtonModule\),\s*import\('@angular\/material\/icon'\)\.then\(m => m\.MatIconModule\),\s*import\('@angular\/material\/tooltip'\)\.then\(m => m\.MatTooltipModule\)\n\s*\][^\}]*\n\s*}\n\s*}\);/g,
  `TestBed.overrideComponent(OpenApiEditorComponent, {
      remove: { imports: [import('ngx-monaco-editor-v2').then(m => m.MonacoEditorModule)] },
      add: { imports: [MockMonacoEditorComponent] }
    });`
);

fs.writeFileSync('src/app/components/openapi-editor/openapi-editor.component.spec.ts', content);
