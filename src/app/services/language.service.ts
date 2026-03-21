import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { LanguageConfig } from '../models/types';

/** The initial predefined list of supported languages. */
const INITIAL_LANGUAGES: LanguageConfig[] = [
  {
    id: 'typescript',
    name: 'TypeScript',
    repo: 'cdd-typescript',
    availableInWasm: true,
    selectedByDefault: true,
    iconUrl: '/assets/icons/typescript.svg',
  },
  {
    id: 'python',
    name: 'Python',
    repo: 'cdd-python',
    availableInWasm: true,
    selectedByDefault: false,
    iconUrl: '/assets/icons/python.svg',
  },
  {
    id: 'java',
    name: 'Java',
    repo: 'cdd-java',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/java.svg',
  },
  {
    id: 'go',
    name: 'Go',
    repo: 'cdd-go',
    availableInWasm: false,
    selectedByDefault: false,
    iconUrl: '/assets/icons/go.svg',
  },
  {
    id: 'rust',
    name: 'Rust',
    repo: 'cdd-rust',
    availableInWasm: true,
    selectedByDefault: true,
    iconUrl: '/assets/icons/rust.svg',
  },
];

/**
 * Service to manage the available programming languages and their WebAssembly support state.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  /** The HTTP client instance for making requests. */
  private http = inject(HttpClient);

  /** A reactive signal containing the current supported languages. */
  languages = signal<LanguageConfig[]>(INITIAL_LANGUAGES);

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
          langs.map((l) => ({
            ...l,
            availableInWasm: supportMap[l.id] ?? false,
          })),
        );
      }
    } catch (e) {
      console.warn('Failed to load WASM support config', e);
    }
  }
}
