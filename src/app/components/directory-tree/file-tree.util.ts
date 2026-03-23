/**
 * Represents a node in the directory tree (either a file or a folder).
 */
export interface FileNode {
  /** The name of the file or folder (e.g., 'src', 'index.ts') */
  name: string;
  /** The full path of the file from the root (e.g., 'src/index.ts') */
  path: string;
  /** Whether this node is a directory */
  isDirectory: boolean;
  /** The children of this directory (if isDirectory is true) */
  children?: FileNode[];
  /** Whether the folder is currently expanded in the UI */
  isExpanded?: boolean;
}

/**
 * Utility class to convert a flat list of file paths into a nested FileNode tree.
 */
export class FileTreeUtil {
  /**
   * Converts a list of file paths into a recursive FileNode array.
   * @param filePaths Flat list of file paths
   * @returns An array of top-level FileNodes.
   */
  static buildTree(filePaths: string[]): FileNode[] {
    const root: FileNode[] = [];

    for (const filePath of filePaths) {
      const parts = filePath.split('/');
      let currentLevel = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        let existingNode = currentLevel.find((n) => n.name === part);

        if (!existingNode) {
          existingNode = {
            name: part,
            path: currentPath,
            isDirectory: !isFile,
            ...(isFile ? {} : { children: [], isExpanded: true }),
          };
          currentLevel.push(existingNode);
        }

        if (!isFile && existingNode.children) {
          currentLevel = existingNode.children;
        }
      }
    }

    // Sort folders first, then files alphabetically
    this.sortTree(root);
    return root;
  }

  /**
   * Sorts the tree so that folders appear before files, alphabetically.
   * @param nodes The nodes to sort.
   */
  private static sortTree(nodes: FileNode[]): void {
    nodes.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });

    for (const node of nodes) {
      if (node.children) {
        this.sortTree(node.children);
      }
    }
  }

  /**
   * Toggles the expanded state of all directories in the tree.
   * @param nodes The tree to update.
   * @param expanded True to expand all, false to collapse all.
   */
  static setAllExpanded(nodes: FileNode[], expanded: boolean): void {
    for (const node of nodes) {
      if (node.isDirectory) {
        node.isExpanded = expanded;
        if (node.children) {
          this.setAllExpanded(node.children, expanded);
        }
      }
    }
  }
}