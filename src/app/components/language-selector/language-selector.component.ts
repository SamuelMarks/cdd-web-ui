import { Component, ChangeDetectionStrategy, inject, input, output, computed, effect } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { LanguageService } from '../../services/language.service';
import { OfflineService } from '../../services/offline.service';
import { LanguageConfig, Target, LanguageOptions } from '../../models/types';
import { StorageService } from '../../services/storage.service';

/**
 * Dropdown component to select the target programming language and its generation options.
 */
@Component({
  selector: 'app-language-selector',
  imports: [CommonModule, FormsModule, MatSelectModule, MatFormFieldModule, MatTooltipModule, MatIconModule, MatCheckboxModule, NgOptimizedImage],
  template: `
    <div class="language-selector-container">
      <mat-form-field appearance="outline" class="language-selector-field" subscriptSizing="dynamic">
        <mat-select 
          [value]="selectedLanguageId()" 
          (selectionChange)="onSelectionChange($event.value)"
          aria-label="Select Target Language"
        >
          <mat-select-trigger>
            <div class="language-option-trigger">
               @if (selectedLanguage()?.iconUrl) {
                 <img [ngSrc]="selectedLanguage()?.iconUrl!" width="20" height="20" alt="" class="language-icon" />
               }
               <span class="language-name">{{ selectedLanguage()?.name }}</span>
            </div>
          </mat-select-trigger>
          @for (lang of processedLanguages(); track lang.id) {
            <mat-option 
              [value]="lang.id" 
              [disabled]="lang.isDisabled"
            >
              <div 
                class="language-option" 
                [matTooltip]="lang.isDisabled ? 'This language requires an internet connection for code generation.' : ''"
              >
                @if (lang.iconUrl) {
                  <img [ngSrc]="lang.iconUrl" width="20" height="20" alt="" class="language-icon" />
                }
                <span class="language-name">{{ lang.name }}</span>
                @if (lang.isDisabled) {
                  <mat-icon class="disabled-indicator">wifi_off</mat-icon>
                }
              </div>
            </mat-option>
          }
        </mat-select>
      </mat-form-field>
      
      <mat-form-field appearance="outline" class="target-selector-field" subscriptSizing="dynamic">
        <mat-select
          [value]="target()"
          (selectionChange)="onTargetChange($event.value)"
          aria-label="Select Target Output"
        >
          <mat-option value="to_sdk">Client SDK</mat-option>
          <mat-option value="to_sdk_cli">Client CLI</mat-option>
          <mat-option value="to_server">Server</mat-option>
        </mat-select>
      </mat-form-field>

      <div class="language-options">
        @if (selectedLanguageId() === 'typescript' && target() !== 'to_server') {
          <mat-form-field appearance="outline" class="framework-selector-field" subscriptSizing="dynamic">
             <mat-label>Framework target</mat-label>
             <mat-select
               [value]="options().framework || (target() === 'to_sdk' ? 'angular' : 'fetch')"
               (selectionChange)="onOptionsChange('framework', $event.value)"
             >
               @if (target() === 'to_sdk') {
                 <mat-option value="angular">Angular</mat-option>
               }
               <mat-option value="fetch">Fetch</mat-option>
               <mat-option value="axios">Axios</mat-option>
             </mat-select>
          </mat-form-field>
          <mat-checkbox 
            [checked]="options().autoAdmin || false"
            (change)="onOptionsChange('autoAdmin', $event.checked)">
            Auto-admin
          </mat-checkbox>
        }
        

        @if (['java', 'php', 'python', 'ruby', 'swift'].includes(selectedLanguageId())) {
          <mat-checkbox 
            [checked]="options().noGithubActions || false"
            (change)="onOptionsChange('noGithubActions', $event.checked)">
            No GitHub Actions
          </mat-checkbox>
          <mat-checkbox 
            [checked]="options().noInstallablePackage || false"
            (change)="onOptionsChange('noInstallablePackage', $event.checked)">
            No Installable Package
          </mat-checkbox>
        }
      </div>
    </div>
  `,
  styleUrl: './language-selector.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSelectorComponent {
  /** The currently selected language ID. */
  selectedLanguageId = input.required<string>();
  /** The currently selected target. */
  target = input.required<Target>();
  /** The language options. */
  options = input.required<LanguageOptions>();
  
  /** Emits when the language selection changes. */
  languageChanged = output<string>();
  /** Emits when the target selection changes. */
  targetChanged = output<Target>();
  /** Emits when the language options change. */
  optionsChanged = output<{languageId: string, options: LanguageOptions}>();

  /** Language service dependency */
  private languageService = inject(LanguageService);
  /** Offline service dependency */
  private offlineService = inject(OfflineService);
  /** Storage service dependency */
  private storageService = inject(StorageService);

  /** Computed currently selected language object. */
  selectedLanguage = computed(() => {
    return this.processedLanguages().find(l => l.id === this.selectedLanguageId());
  });

  /** Computed list of languages with their disabled state based on offline mode. */
  processedLanguages = computed(() => {
    const isOnline = this.offlineService.isOnline();
    return this.languageService.languages().map(lang => ({
      ...lang,
      isDisabled: !isOnline && !lang.availableInWasm
    }));
  });

  /** Initializes the component, loading last selected language from storage. */
  constructor() {
    const lastLanguage = this.storageService.getItem<string>('lastSelectedLanguage');
    if (lastLanguage) {
       setTimeout(() => {
         const langConfig = this.processedLanguages().find(l => l.id === lastLanguage);
         if (langConfig && !langConfig.isDisabled) {
           this.languageChanged.emit(lastLanguage);
         }
       }, 0);
    }
    
    effect(() => {
      const currentSelectionId = this.selectedLanguageId();
      const langs = this.processedLanguages();
      const currentLang = langs.find(l => l.id === currentSelectionId);
      
      if (currentLang && currentLang.isDisabled) {
        const fallbackLang = langs.find(l => !l.isDisabled);
        if (fallbackLang) {
          setTimeout(() => {
             this.onSelectionChange(fallbackLang.id);
          }, 0);
        }
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Handles selection change for language dropdown.
   * @param newLangId The ID of the newly selected language.
   */
  onSelectionChange(newLangId: string): void {
    if (newLangId !== this.selectedLanguageId()) {
      this.storageService.setItem('lastSelectedLanguage', newLangId);
      this.languageChanged.emit(newLangId);
    }
  }
  
  /**
   * Handles target output selection change.
   * @param newTarget The newly selected target format.
   */
  onTargetChange(newTarget: Target): void {
     this.targetChanged.emit(newTarget);
     if (this.selectedLanguageId() === 'typescript' && newTarget === 'to_sdk_cli') {
       const currentOpts = this.options();
       if (!currentOpts.framework || currentOpts.framework === 'angular') {
         this.onOptionsChange('framework', 'fetch');
       }
     }
  }
  
  /**
   * Handles changes in target specific language options.
   * @param key The option key.
   * @param value The new option value.
   */
  onOptionsChange(key: string, value: unknown): void {
     const currentOpts = this.options();
     this.optionsChanged.emit({
       languageId: this.selectedLanguageId(),
       options: {
         ...currentOpts,
         [key]: value
       }
     });
  }
}
