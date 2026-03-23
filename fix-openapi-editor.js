const fs = require('fs');
let content = fs.readFileSync('src/app/components/openapi-editor/openapi-editor.component.ts', 'utf8');

// import InputFormat
content = content.replace("import { PETSTORE_SPEC, HELLO_WORLD_SPEC } from '../../models/examples';", "import { PETSTORE_SPEC, HELLO_WORLD_SPEC } from '../../models/examples';\nimport { InputFormat } from '../../models/types';");

// add html
content = content.replace(
`<mat-form-field appearance="outline" class="example-selector">`,
`<mat-form-field appearance="outline" class="format-selector">
          <mat-label>Input Format</mat-label>
          <mat-select [value]="inputFormat()" (selectionChange)="onFormatChange($event.value)">
            <mat-option value="openapi_3_2_0">OpenAPI 3.2.0</mat-option>
            <mat-option value="openapi_older">Swagger / OpenAPI earlier than 3.2.0</mat-option>
            <mat-option value="google_discovery">Google Discovery JSON format</mat-option>
          </mat-select>
        </mat-form-field>
        
        <mat-form-field appearance="outline" class="example-selector">`
);

// add component inputs/outputs
content = content.replace(
`  specContent = input.required<string>();`,
`  specContent = input.required<string>();
  
  /** The current input format. */
  inputFormat = input.required<InputFormat>();
  
  /** Emitted when input format changes. */
  inputFormatChange = output<InputFormat>();`
);

// add method
content = content.replace(
`  onExampleChange(example: 'petstore' | 'hello' | 'custom') {`,
`  onFormatChange(format: InputFormat) {
    this.inputFormatChange.emit(format);
  }

  onExampleChange(example: 'petstore' | 'hello' | 'custom') {`
);

fs.writeFileSync('src/app/components/openapi-editor/openapi-editor.component.ts', content);
