const fs = require('fs');

let css = fs.readFileSync('src/app/components/language-selector/language-selector.component.css', 'utf8');
css += `
.language-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  object-fit: contain;
}
.language-option-trigger {
  display: flex;
  align-items: center;
}
`;
fs.writeFileSync('src/app/components/language-selector/language-selector.component.css', css);

let ts = fs.readFileSync('src/app/components/language-selector/language-selector.component.ts', 'utf8');

ts = ts.replace(
`        <mat-select 
          [value]="selectedLanguageId()" 
          (selectionChange)="onSelectionChange($event.value)"
          aria-label="Select Target Language"
        >
          @for (lang of processedLanguages(); track lang.id) {`,
`        <mat-select 
          [value]="selectedLanguageId()" 
          (selectionChange)="onSelectionChange($event.value)"
          aria-label="Select Target Language"
        >
          <mat-select-trigger>
            <div class="language-option-trigger">
               @if (selectedLanguage()?.iconUrl) {
                 <img [src]="selectedLanguage()?.iconUrl" alt="" class="language-icon" />
               }
               <span class="language-name">{{ selectedLanguage()?.name }}</span>
            </div>
          </mat-select-trigger>
          @for (lang of processedLanguages(); track lang.id) {`
);

ts = ts.replace(
`              <div 
                class="language-option" 
                [matTooltip]="lang.isDisabled ? 'This language requires an internet connection for code generation.' : ''"
              >
                <span class="language-name">{{ lang.name }}</span>`,
`              <div 
                class="language-option" 
                [matTooltip]="lang.isDisabled ? 'This language requires an internet connection for code generation.' : ''"
              >
                @if (lang.iconUrl) {
                  <img [src]="lang.iconUrl" alt="" class="language-icon" />
                }
                <span class="language-name">{{ lang.name }}</span>`
);

ts = ts.replace(
`  processedLanguages = computed(() => {`,
`  selectedLanguage = computed(() => {
    return this.processedLanguages().find(l => l.id === this.selectedLanguageId());
  });

  processedLanguages = computed(() => {`
);

fs.writeFileSync('src/app/components/language-selector/language-selector.component.ts', ts);

