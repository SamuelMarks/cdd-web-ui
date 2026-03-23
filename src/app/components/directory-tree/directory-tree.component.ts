import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FileNode, FileTreeUtil } from './file-tree.util';
import { GeneratedFile } from '../../services/wasm-worker.service';

/**
 * Component to display a recursive directory tree.
 */
@Component({
  selector: 'app-directory-tree',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="directory-tree-container">
      <div class="toolbar" role="toolbar" aria-label="Directory Tree Actions">
        <h2 class="toolbar-title">Explorer</h2>
        
        <button mat-icon-button (click)="expandAll()" matTooltip="Expand All" aria-label="Expand All" [disabled]="!hasFiles()">
          <mat-icon>unfold_more</mat-icon>
        </button>
        <button mat-icon-button (click)="collapseAll()" matTooltip="Collapse All" aria-label="Collapse All" [disabled]="!hasFiles()">
          <mat-icon>unfold_less</mat-icon>
        </button>
      </div>

      <div class="tree-wrapper" role="tree">
        @if (isExecuting()) {
          <div class="loading-skeleton">
            <div class="skeleton-line" style="width: 80%"></div>
            <div class="skeleton-line" style="width: 60%; margin-left: 1rem;"></div>
            <div class="skeleton-line" style="width: 70%; margin-left: 1rem;"></div>
            <div class="skeleton-line" style="width: 40%; margin-left: 2rem;"></div>
            <div class="skeleton-line" style="width: 50%; margin-left: 2rem;"></div>
          </div>
        } @else if (hasFiles()) {
          <!-- Use recursive template for the tree -->
          <ng-container *ngTemplateOutlet="treeNodeTemplate; context: { $implicit: treeNodes() }"></ng-container>
        } @else {
          <div class="empty-state">
            <mat-icon>snippet_folder</mat-icon>
            <p>No files generated.</p>
            <p style="font-size: 0.8rem; margin-top: 0.5rem;">Click 'Run' to generate SDK files from the OpenAPI spec.</p>
          </div>
        }
      </div>
    </div>

    <!-- Recursive template definition -->
    <ng-template #treeNodeTemplate let-nodes>
      <ul>
        @for (node of nodes; track node.path) {
          <li role="treeitem" [attr.aria-expanded]="node.isDirectory ? node.isExpanded : null" [attr.aria-selected]="node.path === activeFilePath()">
            <div
              class="node"
              [class.active]="!node.isDirectory && node.path === activeFilePath()"
              (click)="onNodeClick(node)"
            >
              @if (node.isDirectory) {
                <mat-icon class="icon folder-icon">
                  {{ node.isExpanded ? 'folder_open' : 'folder' }}
                </mat-icon>
              } @else {
                <mat-icon class="icon file-icon">{{ getFileIcon(node.name) }}</mat-icon>
              }
              <span>{{ node.name }}</span>
            </div>
            
            @if (node.isDirectory && node.isExpanded && node.children) {
              <ng-container *ngTemplateOutlet="treeNodeTemplate; context: { $implicit: node.children }"></ng-container>
            }
          </li>
        }
      </ul>
    </ng-template>
  `,
  styleUrl: './directory-tree.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryTreeComponent {
  /** The flat list of generated files from the store. */
  files = input.required<GeneratedFile[]>();
  /** The currently selected file path. */
  activeFilePath = input<string | null>(null);
  /** Whether the app is currently executing a WASM generation task. */
  isExecuting = input<boolean>(false);

  /** Emitted when a file is clicked. */
  fileSelected = output<string>();

  /** The nested tree structure built from the flat files. */
  treeNodes = signal<FileNode[]>([]);

  /** Computed property determining if there are any files to show. */
  hasFiles = computed(() => this.files().length > 0);

  /**
   * Initializes the tree component, subscribing to files changes to rebuild the tree.
   */
  constructor() {
    // Rebuild tree when files input changes
    effect(() => {
      const currentFiles = this.files();
      if (currentFiles.length > 0) {
        const paths = currentFiles.map(f => f.path);
        // We capture existing expansion state if we wanted to be perfectly stateful across regenerations
        // For simplicity and speed, rebuilding tree sets everything to expanded by default in the util
        this.treeNodes.set(FileTreeUtil.buildTree(paths));
      } else {
        this.treeNodes.set([]);
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Handles click events on tree nodes.
   * If it's a file, emits the fileSelected event.
   * If it's a directory, toggles its expanded state.
   */
  onNodeClick(node: FileNode): void {
    if (node.isDirectory) {
      // Toggle expansion natively by modifying the reference 
      // and forcing a signal update to trigger change detection
      node.isExpanded = !node.isExpanded;
      this.treeNodes.update(nodes => [...nodes]);
    } else {
      this.fileSelected.emit(node.path);
    }
  }

  /**
   * Expands all folders in the tree.
   */
  expandAll(): void {
    const nodes = this.treeNodes();
    FileTreeUtil.setAllExpanded(nodes, true);
    this.treeNodes.update(() => [...nodes]);
  }

  /**
   * Collapses all folders in the tree.
   */
  collapseAll(): void {
    const nodes = this.treeNodes();
    FileTreeUtil.setAllExpanded(nodes, false);
    this.treeNodes.update(() => [...nodes]);
  }

  /**
   * Simple icon mapper based on file extension.
   * @param filename The name of the file.
   * @returns Material icon name.
   */
  getFileIcon(filename: string): string {
    if (filename.endsWith('.ts') || filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.json')) return 'data_object';
    if (filename.endsWith('.md')) return 'description';
    if (filename.endsWith('.rs')) return 'code';
    if (filename.endsWith('.py')) return 'code';
    if (filename.endsWith('.go')) return 'code';
    return 'insert_drive_file';
  }
}
