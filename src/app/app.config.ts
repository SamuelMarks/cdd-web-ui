/**
 * Main Application Configuration
 * @module app/config
 */
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  importProvidersFrom,
  APP_INITIALIZER,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

import { routes } from './app.routes';
import { LanguageService } from './services/language.service';

const monacoConfig = {
  baseUrl: '/assets', // configure base path for monaco editor
  defaultOptions: { scrollBeyondLastLine: false }, // pass default options to be used
};

export function initWasmSupport(languageService: LanguageService) {
  return () => languageService.loadWasmSupport();
}

/**
 * The core configuration object for bootstrapping the Angular application.
 * Provides routing and asynchronous animations.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(),
    importProvidersFrom(MonacoEditorModule.forRoot(monacoConfig)),
    {
      provide: APP_INITIALIZER,
      useFactory: initWasmSupport,
      deps: [LanguageService],
      multi: true,
    },
  ],
};
