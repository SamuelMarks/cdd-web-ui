import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  HostListener, // We cannot use @HostListener as decorator, but we'll use Host bindings or document events
  ElementRef,
  inject,
  TemplateRef,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LayoutOrientation } from '../../store/state';

/**
 * A layout component that provides a resizable dual-pane interface with a central action bar.
 */
@Component({
  selector: 'app-split-pane',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
    <div
      class="split-pane-container"
      (mousemove)="onDrag($event)"
      (mouseup)="onDragEnd()"
      (mouseleave)="onDragEnd()"
    >
      <!-- Left Pane -->
      <div
        class="pane pane-left"
        [style.width]="isMobile() ? '100%' : splitPos() + '%'"
        [style.height]="isMobile() ? splitPos() + '%' : '100%'"
      >
        <ng-container *ngTemplateOutlet="leftTemplate() || null"></ng-container>
      </div>

      <!-- Resizer -->
      <div
        class="resizer"
        [class.resizing]="isDragging()"
        [style.left]="isMobile() ? '0' : 'calc(' + splitPos() + '% - 6px)'"
        [style.top]="isMobile() ? 'calc(' + splitPos() + '% - 6px)' : '0'"
        (mousedown)="onDragStart($event)"
      >
        <div class="resizer-action-top" (mousedown)="$event.stopPropagation()">
          <button
            mat-flat-button
            color="primary"
            class="generate-btn"
            (click)="runClicked.emit();"
            [disabled]="isExecuting()"
            [matTooltip]="runTooltip()"
            [attr.aria-label]="runTooltip()"
          >
            @if (isExecuting()) {
              <mat-spinner diameter="20" class="run-spinner"></mat-spinner>
            } @else {
              <mat-icon>play_arrow</mat-icon>
            }
            Generate
          </button>
        </div>

        <button
          mat-icon-button
          class="resizer-swap-btn"
          (click)="swapClicked.emit(); $event.stopPropagation()"
          (mousedown)="$event.stopPropagation()"
          [disabled]="isExecuting()"
          matTooltip="Swap Panes (Ctrl+Shift+S)"
          aria-label="Swap Panes"
        >
          <mat-icon>swap_horiz</mat-icon>
        </button>
      </div>

      <!-- Right Pane -->
      <div
        class="pane pane-right"
        [style.width]="isMobile() ? '100%' : (100 - splitPos()) + '%'"
        [style.height]="isMobile() ? (100 - splitPos()) + '%' : '100%'"
      >
        <ng-container *ngTemplateOutlet="rightTemplate() || null"></ng-container>
      </div>
    </div>
  `,
  styleUrl: './split-pane.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.control.s)': 'handleKeydown($event)',
    '(document:keydown.meta.s)': 'handleKeydown($event)',
    '(window:resize)': 'checkMobile()',
  }
})
/**
 * A layout component that provides a resizable dual-pane interface with a central action bar.
 */
export class SplitPaneComponent {
  /** The template to render in the left pane. */
  leftTemplate = input<TemplateRef<unknown>>();
  /** The template to render in the right pane. */
  rightTemplate = input<TemplateRef<unknown>>();
  
  /** Current layout orientation from state. */
  orientation = input.required<LayoutOrientation>();
  /** Indicates if WASM generation is active. */
  isExecuting = input<boolean>(false);

  /** Emitted when the Swap button is clicked. */
  swapClicked = output<void>();
  /** Emitted when the Generate button is clicked. */
  runClicked = output<void>();

  /** Dynamic tooltip for the Run button based on orientation. */
  runTooltip = computed(() => 
    this.orientation() === 'openapi-left' 
      ? 'Generate Code (from_openapi)' 
      : 'Generate OpenAPI (to_openapi)'
  );

  /** Element reference for size calculations. */
  private el = inject(ElementRef);

  // Internal state
  /** Tracks whether the resizer is currently being dragged. */
  isDragging = signal(false);
  /** Current split position as a percentage (0-100). */
  splitPos = signal(50);
  /** Tracks if viewport is mobile sized. */
  isMobile = signal(false);

  /**
   * Initializes the split pane and determines if layout should be mobile stacked.
   */
  constructor() {
    this.checkMobile();
  }

  /**
   * Initializes drag state.
   * @param event The mousedown event.
   */
  onDragStart(event: MouseEvent | TouchEvent): void {
    event.preventDefault(); // Prevent text selection
    this.isDragging.set(true);
  }

  /**
   * Updates the split position during drag.
   * @param event The mousemove event.
   */
  onDrag(event: MouseEvent): void {
    if (!this.isDragging()) return;

    const container = this.el.nativeElement.querySelector('.split-pane-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    
    if (this.isMobile()) {
      // Vertical split
      let newY = event.clientY - rect.top;
      let newPos = (newY / rect.height) * 100;
      // Clamp between 20% and 80%
      newPos = Math.max(20, Math.min(newPos, 80));
      this.splitPos.set(newPos);
    } else {
      // Horizontal split
      let newX = event.clientX - rect.left;
      let newPos = (newX / rect.width) * 100;
      // Clamp between 20% and 80%
      newPos = Math.max(20, Math.min(newPos, 80));
      this.splitPos.set(newPos);
    }
  }

  /**
   * Ends the drag operation.
   */
  onDragEnd(): void {
    this.isDragging.set(false);
  }

  /**
   * Checks window size to toggle mobile mode layout.
   */
  checkMobile(): void {
    this.isMobile.set(window.innerWidth <= 768);
  }

  /**
   * Handles keyboard shortcuts.
   * @param event Keyboard event
   */
  handleKeydown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 's' || keyboardEvent.key === 'S') {
      keyboardEvent.preventDefault();
      if (this.isExecuting()) return;

      if (keyboardEvent.shiftKey) {
        this.swapClicked.emit();
      } else {
        this.runClicked.emit();
      }
    }
  }
}
