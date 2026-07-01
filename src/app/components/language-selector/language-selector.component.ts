import { Component, inject, input, output, computed, effect } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/state';
import { selectExecutionError } from '../../store/selectors';
import { LanguageService } from '../../services/language.service';
import { OfflineService } from '../../services/offline.service';
import { Target, LanguageOptions } from '../../models/types';
import { StorageService } from '../../services/storage.service';
import { environment } from '../../../environments/environment';

/**
 * Dropdown component to select the target programming language and its generation options.
 */
@Component({
  selector: 'app-language-selector',
  /** imports */
  imports: [
    CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatIconModule,
    MatCheckboxModule,
    NgOptimizedImage,
  ],
  /** template */
  template: `
    <div class="language-selector-container">
      <div class="language-selector-wrapper">
        @if (!environment.singleLanguageMode) {
          <mat-form-field
            appearance="outline"
            class="language-selector-field"
            [class.has-error]="hasError()"
            [matTooltip]="
              hasError() ? errorMessage() || 'Failed to generate code for this language' : ''
            "
            subscriptSizing="dynamic"
            [color]="hasError() ? 'warn' : 'primary'"
          >
            <mat-label [class.error-text]="hasError()" i18n>Language</mat-label>
            <mat-select
              [value]="selectedLanguageId()"
              (selectionChange)="onSelectionChange($event.value)"
              aria-label="Select Target Language"
              i18n-aria-label="@@selectTargetLangAria"
            >
              <mat-select-trigger>
                <div class="language-option-trigger">
                  @if (selectedLanguage()?.iconUrl) {
                    <img
                      [ngSrc]="selectedLanguage()?.iconUrl!"
                      width="20"
                      height="20"
                      alt=""
                      class="language-icon"
                    />
                  }
                  <span class="language-name" [class.error-text]="hasError()">{{
                    selectedLanguage()?.name
                  }}</span>
                </div>
              </mat-select-trigger>
              @for (lang of processedLanguages(); track lang.id) {
                <mat-option [value]="lang.id" [disabled]="lang.isDisabled">
                  <div
                    class="language-option"
                    [matTooltip]="
                      lang.isDisabled
                        ? 'Languages shown as disabled are not available in the current offline-only environment. To enable generation for all supported languages, configure the application for &quot;Online Mode&quot; by following the backend setup instructions on our GitHub repository.'
                        : ''
                    "
                  >
                    @if (lang.iconUrl) {
                      <img
                        [ngSrc]="lang.iconUrl"
                        width="20"
                        height="20"
                        alt=""
                        class="language-icon"
                      />
                    }
                    <span class="language-name">{{ lang.name }}</span>
                    @if (lang.isDisabled) {
                      <mat-icon class="disabled-indicator" aria-hidden="true">wifi_off</mat-icon>
                    }
                  </div>
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-icon
            class="offline-info-icon"
            aria-hidden="true"
            matTooltip="Languages shown as disabled are not available in the current offline-only environment. To enable generation for all supported languages, configure the application for 'Online Mode' by following the backend setup instructions on our GitHub repository."
            i18n-matTooltip
          >
            help_outline
          </mat-icon>
        }
      </div>

      <mat-form-field appearance="outline" class="target-selector-field" subscriptSizing="dynamic">
        <mat-label i18n>Target</mat-label>
        <mat-select
          [value]="target()"
          (selectionChange)="onTargetChange($event.value)"
          aria-label="Select Target Output"
          i18n-aria-label="@@selectTargetOutputAria"
        >
          <mat-option value="to_sdk" i18n>Client SDK</mat-option>
          <mat-option value="to_sdk_cli" i18n>Client CLI</mat-option>
          <mat-option value="to_mcp" i18n>MCP Server</mat-option>
          <mat-option value="to_server" i18n>Server</mat-option>
          @if (selectedLanguageId() === 'typescript') {
            <mat-option value="to_orm" i18n>ORM Entities</mat-option>
          }
          @if (environment.singleLanguageMode) {
            <mat-option value="to_openapi_3_2_0" i18n>OpenAPI 3.2.0</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <div class="language-options">
        @if (
          selectedLanguageId() === 'typescript' && target() !== 'to_server' && target() !== 'to_orm'
        ) {
          <mat-form-field
            appearance="outline"
            class="framework-selector-field"
            subscriptSizing="dynamic"
          >
            <mat-label i18n>Client Framework</mat-label>
            <mat-select
              [value]="options().framework || 'vanilla'"
              (selectionChange)="onOptionsChange('framework', $event.value)"
              aria-label="Select Client Framework"
              i18n-aria-label="@@selectClientFrameworkAria"
            >
              <mat-option value="vanilla" i18n>Vanilla JS</mat-option>
              <mat-option value="angular" i18n>Angular</mat-option>
              <mat-option value="react" i18n>React</mat-option>
              <mat-option value="vue" i18n>Vue</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-checkbox
            [checked]="options().autoAdmin || false"
            (change)="onOptionsChange('autoAdmin', $event.checked)"
          >
            <span i18n>Auto-admin</span>
          </mat-checkbox>
        }

        @if (selectedLanguageId() === 'typescript' && target() === 'to_server') {
          <mat-form-field
            appearance="outline"
            class="framework-selector-field"
            subscriptSizing="dynamic"
          >
            <mat-label i18n>Server Framework</mat-label>
            <mat-select
              [value]="options().serverFramework || 'express'"
              (selectionChange)="onOptionsChange('serverFramework', $event.value)"
              aria-label="Select Server Framework"
              i18n-aria-label="@@selectServerFrameworkAria"
            >
              <mat-option value="express" i18n>Express</mat-option>
              <mat-option value="node" i18n>Node.js HTTP</mat-option>
              <mat-option value="bun" i18n>Bun</mat-option>
              <mat-option value="deno" i18n>Deno</mat-option>
            </mat-select>
          </mat-form-field>
        }

        @if (selectedLanguageId() === 'typescript' && target() === 'to_orm') {
          <mat-form-field
            appearance="outline"
            class="framework-selector-field"
            subscriptSizing="dynamic"
          >
            <mat-label i18n>ORM Engine</mat-label>
            <mat-select
              [value]="options().orm || 'typeorm'"
              (selectionChange)="onOptionsChange('orm', $event.value)"
              aria-label="Select ORM Engine"
              i18n-aria-label="@@selectOrmEngineAria"
            >
              <mat-option value="typeorm" i18n>TypeORM</mat-option>
            </mat-select>
          </mat-form-field>
        }

        @if (selectedLanguageId() && target() !== 'to_mcp' && target() !== 'to_openapi_3_2_0') {
          <mat-checkbox
            [checked]="!options().noGithubActions"
            (change)="onOptionsChange('noGithubActions', !$event.checked)"
          >
            <span i18n>CI</span>
          </mat-checkbox>
        }

        @if (selectedLanguageId() !== 'sh' && target() !== 'to_openapi_3_2_0') {
          <mat-checkbox
            [checked]="!options().noInstallablePackage"
            (change)="onOptionsChange('noInstallablePackage', !$event.checked)"
          >
            <span i18n>Package</span>
          </mat-checkbox>
        }

        @if (selectedLanguageId() && target() !== 'to_openapi_3_2_0' && !options().noTestGen) {
          <mat-checkbox
            [checked]="options().tests || false"
            (change)="onOptionsChange('tests', $event.checked)"
          >
            <span i18n>Tests</span>
          </mat-checkbox>
        }

        @if (selectedLanguageId() === 'typescript') {
          <mat-checkbox
            [checked]="!options().noTestGen"
            (change)="onOptionsChange('noTestGen', !$event.checked)"
          >
            <span i18n>Enable Tests</span>
          </mat-checkbox>
        }

        @if (selectedLanguageId() && target() !== 'to_mcp' && target() !== 'to_openapi_3_2_0') {
          <mat-checkbox
            [checked]="options().mcp || false"
            (change)="onOptionsChange('mcp', $event.checked)"
          >
            <span i18n>MCP</span>
          </mat-checkbox>
        }

        @if (target() === 'to_server' && ['ruby', 'php', 'kotlin'].includes(selectedLanguageId())) {
          <mat-checkbox
            [checked]="options().withEphemeral || false"
            (change)="onOptionsChange('withEphemeral', $event.checked)"
          >
            <span i18n>Sandbox (Ephemeral)</span>
          </mat-checkbox>
          <mat-checkbox
            [checked]="options().withSeed || false"
            (change)="onOptionsChange('withSeed', $event.checked)"
            [disabled]="!options().withEphemeral"
          >
            <span i18n>Mock Seed</span>
          </mat-checkbox>
        }

        @if (target() === 'to_server' && selectedLanguageId() === 'typescript') {
          <mat-checkbox
            [checked]="!options().noGenerateServices"
            (change)="onOptionsChange('noGenerateServices', !$event.checked)"
          >
            <span i18n>Services</span>
          </mat-checkbox>
        }
      </div>
    </div>
  `,
  /** styleUrl */
  styleUrl: './language-selector.component.css',
})
/** LanguageSelectorComponent */
export class LanguageSelectorComponent {
  /** Environment configuration */
  protected readonly environment = environment;

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
  optionsChanged = output<{ languageId: string; options: LanguageOptions }>();

  /** Store dependency */
  private store = inject(Store<AppState>);
  /** Language service dependency */
  private languageService = inject(LanguageService);
  /** Offline service dependency */
  private offlineService = inject(OfflineService);
  /** Storage service dependency */
  private storageService = inject(StorageService);

  /** Computed error state based on executionError in the store */
  hasError = computed(() => !!this.store.selectSignal(selectExecutionError)());
  /** The actual execution error message */
  errorMessage = this.store.selectSignal(selectExecutionError);

  /** Computed currently selected language object. */
  selectedLanguage = computed(() => {
    return this.processedLanguages().find((l) => l.id === this.selectedLanguageId());
  });

  /** Computed list of languages with their disabled state based on offline mode. */
  processedLanguages = computed(() => {
    const isOnline = this.offlineService.isOnline();
    return this.languageService.languages().map((lang) => ({
      ...lang,
      isDisabled: !isOnline && !lang.availableInWasm,
    }));
  });

  /** Initializes the component, loading last selected language from storage. */
  constructor() {
    const lastLanguage = this.storageService.getItem<string>('lastSelectedLanguage');
    if (lastLanguage) {
      setTimeout(() => {
        const langConfig = this.processedLanguages().find((l) => l.id === lastLanguage);
        if (langConfig && !langConfig.isDisabled) {
          this.languageChanged.emit(lastLanguage);
        }
      }, 0);
    }

    /** effect */
    effect(() => {
      const currentSelectionId = this.selectedLanguageId();
      const langs = this.processedLanguages();
      const currentLang = langs.find((l) => l.id === currentSelectionId);

      if (currentLang && currentLang.isDisabled) {
        const fallbackLang = langs.find((l) => !l.isDisabled);
        if (fallbackLang) {
          setTimeout(() => {
            this.onSelectionChange(fallbackLang.id);
          }, 0);
        }
      }
    });
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
    if (this.selectedLanguageId() === 'typescript') {
      const currentOpts = this.options();
      if (newTarget === 'to_sdk_cli') {
        if (
          currentOpts.framework === undefined ||
          ['angular', 'react', 'vue'].includes(currentOpts.framework)
        ) {
          this.onOptionsChange('framework', 'vanilla');
        }
      } else if (newTarget === 'to_server') {
        if (currentOpts.serverFramework === undefined) {
          this.onOptionsChange('serverFramework', 'express');
        }
      } else if (newTarget === 'to_orm') {
        if (currentOpts.orm === undefined) {
          this.onOptionsChange('orm', 'typeorm');
        }
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
        [key]: value,
      },
    });
  }
}
