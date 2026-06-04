import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { WasmLoaderService } from '../../services/wasm-loader.service';
import { environment } from '../../../environments/environment';

/**
 * Dialog component for loading WASM assets on startup.
 */
@Component({
  selector: 'app-wasm-load-dialog',
  imports: [MatDialogModule, MatButtonModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Load WASM Assets</h2>
    <mat-dialog-content>
      @if (!loading()) {
        <p>
          Compiler Driven Development (CDD) represents a new&mdash;open-source&mdash;approach to SDK
          generation.
        </p>
        @if (environment.singleLanguageMode) {
          <p>
            Rather than a monolithic unidirectional generator, CDD is a suite of standalone
            compilers, each written in their target language. This demo showcases the
            <a href="https://github.com/SamuelMarks/cdd-c" target="_blank">cdd-c</a> compiler
            (written in C). It supports: Swagger 2.0 &amp; OpenAPI 3.2.0; can generate &lbrace;SDKs,
            CLIs, server stubs&rbrace;, and is bidirectional (OpenAPI &#8644; language)
          </p>
        } @else {
          <p>
            Rather than a monolithic unidirectional generator, CDD is 13 standalone compilers, each
            written in their target language (<a
              href="https://github.com/SamuelMarks/cdd-c"
              target="_blank"
              >cdd-c</a
            >
            in C; <a href="https://github.com/SamuelMarks/cdd-ruby" target="_blank">cdd-ruby</a> in
            Ruby; etc.). Each supports: Swagger 2.0 &amp; OpenAPI 3.2.0; can generate &lbrace;SDKs,
            CLIs, server stubs&rbrace;, and is bidirectional (OpenAPI &#8644; language)
          </p>
        }
        <p>
          Every compiler is compiled to WebAssembly (WASM). Do you want to load
          {{ environment.wasmSizeText }} of WASM?
        </p>
        <p>
          This is required to generate code using the selected language in the browser (with no
          server).
        </p>
      } @else {
        <p>Downloading WASM binaries ({{ loadedCount() }} / {{ totalCount() }})...</p>
        <mat-progress-bar
          mode="determinate"
          [value]="progress()"
          aria-label="Downloading WASM binaries progress"
        ></mat-progress-bar>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (!loading()) {
        <button mat-flat-button color="primary" (click)="loadWasm()">
          {{ environment.loadWasmButtonText }}
        </button>
      }
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WasmLoadDialogComponent {
  /** Application environment config */
  protected readonly environment = environment;
  /** The dialog reference */
  readonly dialogRef = inject(MatDialogRef<WasmLoadDialogComponent>);
  /** The WASM loader service */
  readonly wasmLoader = inject(WasmLoaderService);

  /** Indicates if loading is in progress */
  loading = signal(false);
  /** Count of currently loaded items */
  loadedCount = signal(0);
  /** Total count of items to load */
  totalCount = signal(environment.languages.length);
  /** Overall progress percentage */
  progress = signal(0);

  /**
   * Triggers the load of all WASM binaries.
   */
  async loadWasm(): Promise<void> {
    this.loading.set(true);
    await this.wasmLoader.preloadAllWasm((loaded, total) => {
      this.loadedCount.set(loaded);
      this.totalCount.set(total);
      this.progress.set((loaded / total) * 100);
    });
    this.dialogRef.close(true);
  }
}
