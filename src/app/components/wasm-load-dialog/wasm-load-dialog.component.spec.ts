import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WasmLoadDialogComponent } from './wasm-load-dialog.component';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { WasmLoaderService } from '../../services/wasm-loader.service';
import { vi } from 'vitest';

describe('WasmLoadDialogComponent', () => {
  let component: WasmLoadDialogComponent;
  let fixture: ComponentFixture<WasmLoadDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockWasmLoader: { preloadAllWasm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn(),
    };

    mockWasmLoader = {
      preloadAllWasm: vi.fn().mockImplementation(async (cb) => {
        if (cb) {
          cb(13, 13);
        }
      }),
    };

    await TestBed.configureTestingModule({
      imports: [WasmLoadDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: WasmLoaderService, useValue: mockWasmLoader },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WasmLoadDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start loading, call preloadAllWasm with callback, and close dialog', async () => {
    await component.loadWasm();

    expect(component.loading()).toBe(true);
    expect(mockWasmLoader.preloadAllWasm).toHaveBeenCalled();
    expect(component.loadedCount()).toBe(13);
    expect(component.totalCount()).toBe(13);
    expect(component.progress()).toBe(100);
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });
});
