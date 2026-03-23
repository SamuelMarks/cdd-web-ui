const fs = require('fs');
let content = fs.readFileSync('src/app/components/openapi-editor/openapi-editor.component.ts', 'utf8');

// remove buttons from toolbar
content = content.replace(
`        <mat-form-field appearance="outline" class="example-selector">
          <mat-label>Example</mat-label>
          <mat-select [value]="selectedExample()" (selectionChange)="onExampleChange($event.value)">
            <mat-option value="petstore">Petstore</mat-option>
            <mat-option value="hello">Hello World</mat-option>
            <mat-option value="custom" [disabled]="true">Custom</mat-option>
          </mat-select>
        </mat-form-field>
        
        <button mat-button (click)="formatDocument()" matTooltip="Format Document" aria-label="Format Document">
          <mat-icon>format_align_left</mat-icon>
          Format
        </button>
        <button mat-button (click)="copyToClipboard()" matTooltip="Copy to Clipboard" aria-label="Copy to Clipboard">
          <mat-icon>content_copy</mat-icon>
          Copy
        </button>
        <button mat-button color="warn" (click)="clearEditor()" matTooltip="Clear Editor" aria-label="Clear Editor">
          <mat-icon>delete_outline</mat-icon>
          Clear
        </button>
      </div>`,
`        <mat-form-field appearance="outline" class="example-selector">
          <mat-label>Example</mat-label>
          <mat-select [value]="selectedExample()" (selectionChange)="onExampleChange($event.value)">
            <mat-option value="petstore">Petstore</mat-option>
            <mat-option value="hello">Hello World</mat-option>
            <mat-option value="custom" [disabled]="true">Custom</mat-option>
          </mat-select>
        </mat-form-field>
      </div>`
);

// insert buttons into editor-wrapper
content = content.replace(
`      <div class="editor-wrapper">
        <ngx-monaco-editor`,
`      <div class="editor-wrapper">
        <div class="editor-floating-actions">
          <button mat-icon-button (click)="formatDocument()" matTooltip="Format Document" aria-label="Format Document">
            <mat-icon>format_align_left</mat-icon>
          </button>
          <button mat-icon-button (click)="copyToClipboard()" matTooltip="Copy to Clipboard" aria-label="Copy to Clipboard">
            <mat-icon>content_copy</mat-icon>
          </button>
          <button mat-icon-button color="warn" (click)="clearEditor()" matTooltip="Clear Editor" aria-label="Clear Editor">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
        <ngx-monaco-editor`
);

fs.writeFileSync('src/app/components/openapi-editor/openapi-editor.component.ts', content);
