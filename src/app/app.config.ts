/**
 * Main Application Configuration
 * @module app/config
 */
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  importProvidersFrom,
  APP_INITIALIZER,
  provideZoneChangeDetection,
  ErrorHandler,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import * as Sentry from '@sentry/angular';

import { routes } from './app.routes';
import { LanguageService } from './services/language.service';
import { reducers } from './store';
import { WorkspaceEffects } from './store/effects';

/**
 * Configuration options for the Monaco editor.
 */
const monacoConfig = {
  /** baseUrl */
  baseUrl: '/assets/vs', // configure base path for monaco editor
  /** defaultOptions */
  defaultOptions: { scrollBeyondLastLine: false }, // pass default options to be used
};

/**
 * Factory function to initialize WebAssembly support.
 * @param languageService The language service to use.
 * @returns A function that initializes WASM support.
 */
export function initWasmSupport(languageService: LanguageService) {
  return () => languageService.loadWasmSupport();
}

/**
 * The core configuration object for bootstrapping the Angular application.
 * Provides routing and asynchronous animations.
 */
export const appConfig: ApplicationConfig = {
  /** providers */
  providers: [
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler() },
    /** provideZoneChangeDetection */
    provideZoneChangeDetection({ eventCoalescing: true }),
    /** provideBrowserGlobalErrorListeners */
    provideBrowserGlobalErrorListeners(),
    /** provideRouter */
    provideRouter(routes),
    /** provideAnimationsAsync */
    provideAnimationsAsync(),
    /** provideHttpClient */
    provideHttpClient(),
    /** importProvidersFrom */
    importProvidersFrom(MonacoEditorModule.forRoot(monacoConfig)),
    /** provideStore */
    provideStore(reducers, {
      runtimeChecks: {
        strictStateImmutability: false,
        strictActionImmutability: false,
      },
    }),
    /** provideEffects */
    provideEffects(WorkspaceEffects),
    /** provideStoreDevtools */
    provideStoreDevtools({ maxAge: 25, logOnly: false }),
    {
      provide: APP_INITIALIZER,
      useFactory: initWasmSupport,
      deps: [LanguageService],
      multi: true,
    },
  ],
};
