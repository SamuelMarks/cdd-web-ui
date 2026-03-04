import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { LanguageConfig } from '../models/types';

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

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private http = inject(HttpClient);

  languages = signal<LanguageConfig[]>(INITIAL_LANGUAGES);

  async loadWasmSupport(): Promise<void> {
    try {
      const supportMap = await firstValueFrom(
        this.http
          .get<Record<string, boolean>>('/assets/wasm-support.json')
          .pipe(catchError(() => of(null))),
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
      /* v8 ignore next 2 */
      console.warn('Failed to load WASM support config', e);
    }
  }
}
