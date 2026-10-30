/**
 * Recursive directory tree component for browsing generated SDK and server files.
 * @module app/components/directory-tree/directory-tree.component
 */
import { Component, input, output, computed, linkedSignal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
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
  /** imports */
  imports: [NgTemplateOutlet, MatButtonModule, MatIconModule, MatTooltipModule],
  /** template */
  template: `
    <div class="directory-tree-container">
      <div
        class="toolbar"
        role="toolbar"
        aria-label="Directory Tree Actions"
        i18n-aria-label="@@dirTreeActionsAria"
      >
        <h2 class="toolbar-title" i18n>Explorer</h2>

        <button
          mat-icon-button
          (click)="expandAll()"
          matTooltip="Expand All"
          i18n-matTooltip="@@expandAllTooltip"
          aria-label="Expand All"
          i18n-aria-label="@@expandAllAria"
          [disabled]="!hasFiles()"
        >
          <mat-icon aria-hidden="true">unfold_more</mat-icon>
        </button>
        <button
          mat-icon-button
          (click)="collapseAll()"
          matTooltip="Collapse All"
          i18n-matTooltip="@@collapseAllTooltip"
          aria-label="Collapse All"
          i18n-aria-label="@@collapseAllAria"
          [disabled]="!hasFiles()"
        >
          <mat-icon aria-hidden="true">unfold_less</mat-icon>
        </button>
      </div>

      <div
        class="tree-wrapper"
        role="tree"
        aria-label="Generated Files"
        i18n-aria-label="@@generatedFilesTreeAria"
      >
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
          <ng-container
            *ngTemplateOutlet="
              treeNodeTemplate;
              context: { $implicit: treeNodes(), isGroup: false }
            "
          ></ng-container>
        } @else {
          <div class="empty-state">
            <mat-icon aria-hidden="true">snippet_folder</mat-icon>
            <p i18n="@@noFilesGenerated">No files generated.</p>
            <p style="font-size: 0.8rem; margin-top: 0.5rem;" i18n="@@generateSdkPrompt">
              Click 'Run' to generate SDK files from the OpenAPI spec.
            </p>
          </div>
        }
      </div>
    </div>

    <!-- Recursive template definition -->
    <ng-template #treeNodeTemplate let-nodes let-isGroup="isGroup">
      <ul [attr.role]="isGroup ? 'group' : 'presentation'">
        @for (node of nodes; track node.path; let first = $first) {
          <li
            role="treeitem"
            [attr.tabindex]="getTreeItemTabIndex(node, !isGroup && first)"
            [attr.aria-expanded]="node.isDirectory ? node.isExpanded : null"
            [attr.aria-selected]="node.path === activeFilePath()"
            (keydown)="onTreeItemKeydown($event, node)"
          >
            <div
              class="node"
              [class.active]="!node.isDirectory && node.path === activeFilePath()"
              (click)="onNodeClick(node)"
            >
              @if (node.isDirectory) {
                <mat-icon class="icon folder-icon" aria-hidden="true">
                  {{ node.isExpanded ? 'folder_open' : 'folder' }}
                </mat-icon>
              } @else {
                <mat-icon class="icon file-icon" aria-hidden="true">{{
                  getFileIcon(node.name)
                }}</mat-icon>
              }
              <span>{{ node.name }}</span>
            </div>

            @if (node.isDirectory && node.isExpanded && node.children) {
              <ng-container
                *ngTemplateOutlet="
                  treeNodeTemplate;
                  context: { $implicit: node.children, isGroup: true }
                "
              ></ng-container>
            }
          </li>
        }
      </ul>
    </ng-template>
  `,
  /** styleUrl */
  styleUrl: './directory-tree.component.css',
})
/** DirectoryTreeComponent */
export class DirectoryTreeComponent {
  /** The flat list of generated files from the store. */
  files = input.required<GeneratedFile[]>();
  /** The currently selected file path. */
  activeFilePath = input<string | null>(null);
  /** Whether the app is currently executing a WASM generation task. */
  isExecuting = input<boolean>(false);

  /** Emitted when a file is clicked. */
  fileSelected = output<string>();

  /** The nested tree structure linked to the flat files input. */
  treeNodes = linkedSignal(() => FileTreeUtil.buildTree(this.files().map((f) => f.path)));

  /** Computed property determining if there are any files to show. */
  hasFiles = computed(() => this.files().length > 0);

  /**
   * Computes the roving tabindex for a tree item (`0` for the active file or first root node, `-1` otherwise).
   * @param node The FileNode being rendered.
   * @param isFirstRoot Whether this node is the first item at the root level.
   * @returns `0` if focusable in tab order, `-1` otherwise.
   */
  getTreeItemTabIndex(node: FileNode, isFirstRoot: boolean): number {
    const active = this.activeFilePath();
    if (active) {
      return node.path === active ? 0 : -1;
    }
    return isFirstRoot ? 0 : -1;
  }

  /**
   * Immutably updates a folder node's expanded state within a tree of FileNodes.
   * @param nodes The current list of nodes.
   * @param targetPath The path of the directory node to update.
   * @param isExpanded The new expanded state (or undefined to toggle).
   * @returns A new array of FileNodes with the updated directory node.
   */
  private updateNodeExpansion(
    nodes: FileNode[],
    targetPath: string,
    isExpanded?: boolean,
  ): FileNode[] {
    return nodes.map((n) => {
      if (n.path === targetPath && n.isDirectory) {
        return {
          ...n,
          isExpanded: isExpanded !== undefined ? isExpanded : !n.isExpanded,
        };
      }
      if (n.children) {
        return {
          ...n,
          children: this.updateNodeExpansion(n.children, targetPath, isExpanded),
        };
      }
      return n;
    });
  }

  /**
   * Handles click events on tree nodes.
   * If it's a file, emits the fileSelected event.
   * If it's a directory, toggles its expanded state immutably.
   * @param node The clicked FileNode item.
   */
  onNodeClick(node: FileNode): void {
    if (node.isDirectory) {
      this.treeNodes.update((nodes) => this.updateNodeExpansion(nodes, node.path));
    } else {
      this.fileSelected.emit(node.path);
    }
  }

  /**
   * Handles WAI-ARIA keyboard navigation on treeitem elements.
   * @param event The keyboard event.
   * @param node The corresponding FileNode.
   */
  onTreeItemKeydown(event: KeyboardEvent, node: FileNode): void {
    event.stopPropagation();
    const currentItem = event.currentTarget as HTMLElement | null;
    const treeRoot = currentItem?.closest('[role="tree"]');

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.onNodeClick(node);
        break;
      case 'ArrowRight':
        if (node.isDirectory && !node.isExpanded) {
          event.preventDefault();
          this.treeNodes.update((nodes) => this.updateNodeExpansion(nodes, node.path, true));
        }
        break;
      case 'ArrowLeft':
        if (node.isDirectory && node.isExpanded) {
          event.preventDefault();
          this.treeNodes.update((nodes) => this.updateNodeExpansion(nodes, node.path, false));
        }
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        if (treeRoot && currentItem) {
          event.preventDefault();
          const items = Array.from(treeRoot.querySelectorAll<HTMLElement>('li[role="treeitem"]'));
          const idx = items.indexOf(currentItem);
          const nextIdx = event.key === 'ArrowDown' ? idx + 1 : idx - 1;
          if (nextIdx >= 0 && nextIdx < items.length) {
            items[nextIdx].focus();
          }
        }
        break;
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
