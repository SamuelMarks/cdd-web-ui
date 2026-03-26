import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LanguageConfig } from '../models/types';
import { LANGUAGES } from '../models/constants';

/**
 * Service to manage the available programming languages and their WebAssembly support state.
 */
@Injectable({ providedIn: 'root' })
/** LanguageService */
export class LanguageService {
  /** The HTTP client instance for making requests. */
  private http = inject(HttpClient);

  /** A reactive signal containing the current supported languages. */
  languages = signal<LanguageConfig[]>(LANGUAGES);

  /**
   * Fetches the WebAssembly support configuration from the server
   * and updates the available languages accordingly.
   * @returns A Promise that resolves when the support map is loaded.
   */
  async loadWasmSupport(): Promise<void> {
    try {
      const supportMap = await firstValueFrom(
        this.http.get<Record<string, boolean>>('/assets/wasm-support.json'),
      );

      if (supportMap) {
        this.languages.update((langs) =>
          langs.map((l) => {
            let supportKey = l.id;
            if (l.id === 'typescript') supportKey = 'ts';
            if (l.id === 'openapi') supportKey = 'cpp';

            return {
              ...l,
              availableInWasm: supportMap[supportKey] ?? false,
            };
          }),
        );
      }
    } catch (e) {
      console.warn('Failed to load WASM support config', e);
    }
  }
}
