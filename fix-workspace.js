const fs = require('fs');
let content = fs.readFileSync('src/app/pages/workspace/workspace.component.ts', 'utf8');

// import InputFormat
content = content.replace("import { Target, LanguageOptions } from '../../models/types';", "import { Target, LanguageOptions, InputFormat } from '../../models/types';");

// add inputFormat selector
content = content.replace("specContent = this.store.selectSignal(Selectors.selectOpenApiSpecContent);", "specContent = this.store.selectSignal(Selectors.selectOpenApiSpecContent);\n  inputFormat = this.store.selectSignal(Selectors.selectOpenApiInputFormat);");

// pass to OpenApiEditorComponent
content = content.replace(
`<app-openapi-editor
        [specContent]="specContent() || ''"
        (specContentChange)="onSpecContentChange($event)"
        (validationErrorsChange)="onValidationErrorsChange($event)"
      ></app-openapi-editor>`,
`<app-openapi-editor
        [specContent]="specContent() || ''"
        [inputFormat]="inputFormat() || 'openapi_3_2_0'"
        (specContentChange)="onSpecContentChange($event)"
        (inputFormatChange)="onInputFormatChange($event)"
        (validationErrorsChange)="onValidationErrorsChange($event)"
      ></app-openapi-editor>`
);

// add handler
content = content.replace(
`  onSpecContentChange(content: string): void {
    this.store.dispatch(Actions.updateOpenApiSpec({ content }));
  }`,
`  onSpecContentChange(content: string): void {
    this.store.dispatch(Actions.updateOpenApiSpec({ content }));
  }

  onInputFormatChange(format: InputFormat): void {
    this.store.dispatch(Actions.setInputFormat({ format }));
  }`
);

fs.writeFileSync('src/app/pages/workspace/workspace.component.ts', content);
