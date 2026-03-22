import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { LanguageConfig } from '../models/types';

/** The initial predefined list of supported languages. */
const INITIAL_LANGUAGES: LanguageConfig[] = [
  { id: 'c', name: 'C', repo: 'cdd-c', availableInWasm: true, selectedByDefault: true, iconUrl: '/assets/icons/c.svg' },
  { id: 'cpp', name: 'C++', repo: 'cdd-cpp', availableInWasm: false, selectedByDefault: false, iconUrl: '/assets/icons/cpp.svg' },
  { id: 'csharp', name: 'C#', repo: 'cdd-csharp', availableInWasm: false, selectedByDefault: false, iconUrl: '/assets/icons/csharp.svg' },
  { id: 'go', name: 'Go', repo: 'cdd-go', availableInWasm: false, selectedByDefault: false, iconUrl: '/assets/icons/go.svg' },
  { id: 'java', name: 'Java', repo: 'cdd-java', availableInWasm: false, selectedByDefault: false, iconUrl: '/assets/icons/java.svg' },
  { id: 'kotlin', name: 'Kotlin', repo: 'cdd-kotlin', availableInWasm: false, selectedByDefault: false, iconUrl: '/assets/icons/kotlin.svg' },
  { id: 'php', name: 'PHP', repo: 'cdd-php', availableInWasm: false, selectedByDefault: false, iconUrl: '/assets/icons/php.svg' },
  { id: 'python', name: 'Python', repo: 'cdd-python', availableInWasm: true, selectedByDefault: false, iconUrl: '/assets/icons/python.svg' },
  { id: 'ruby', name: 'Ruby', repo: 'cdd-ruby', availableInWasm: false, selectedByDefault: false, iconUrl: '/assets/icons/ruby.svg' },
  { id: 'rust', name: 'Rust', repo: 'cdd-rust', availableInWasm: true, selectedByDefault: true, iconUrl: '/assets/icons/rust.svg' },
  { id: 'sh', name: 'Shell', repo: 'cdd-sh', availableInWasm: false, selectedByDefault: false, iconUrl: '/assets/icons/sh.svg' },
  { id: 'swift', name: 'Swift', repo: 'cdd-swift', availableInWasm: false, selectedByDefault: false, iconUrl: '/assets/icons/swift.svg' },
  { id: 'typescript', name: 'TypeScript', repo: 'cdd-ts', availableInWasm: true, selectedByDefault: true, iconUrl: '/assets/icons/typescript.svg' },
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
