import { FileTreeUtil, FileNode } from './file-tree.util';
import { describe, it, expect } from 'vitest';

describe('FileTreeUtil', () => {
  it('should build a nested tree from flat paths', () => {
    const paths = [
      'src/index.ts',
      'src/utils/math.ts',
      'package.json'
    ];

    const tree = FileTreeUtil.buildTree(paths);

    expect(tree.length).toBe(2);
    expect(tree[0].name).toBe('src'); // sorted directories first
    expect(tree[0].isDirectory).toBe(true);
    expect(tree[0].children?.length).toBe(2);

    expect(tree[1].name).toBe('package.json');
    expect(tree[1].isDirectory).toBe(false);

    const srcChildren = tree[0].children!;
    expect(srcChildren[0].name).toBe('utils');
    expect(srcChildren[0].isDirectory).toBe(true);
    expect(srcChildren[0].children![0].name).toBe('math.ts');

    expect(srcChildren[1].name).toBe('index.ts');
    expect(srcChildren[1].isDirectory).toBe(false);
  });

  it('should sort directories first then files alphabetically', () => {
    const paths = [
      'z-file.ts',
      'a-folder/file.ts',
      'a-file.ts',
      'z-folder/file.ts'
    ];

    const tree = FileTreeUtil.buildTree(paths);

    expect(tree[0].name).toBe('a-folder');
    expect(tree[1].name).toBe('z-folder');
    expect(tree[2].name).toBe('a-file.ts');
    expect(tree[3].name).toBe('z-file.ts');
  });

  it('should set all expanded', () => {
     const paths = [
      'src/a/1.ts',
      'src/b/2.ts',
    ];
    const tree = FileTreeUtil.buildTree(paths);

    // Initial state is expanded: true
    expect(tree[0].isExpanded).toBe(true);
    expect(tree[0].children![0].isExpanded).toBe(true);

    FileTreeUtil.setAllExpanded(tree, false);

    expect(tree[0].isExpanded).toBe(false);
    expect(tree[0].children![0].isExpanded).toBe(false);

    FileTreeUtil.setAllExpanded(tree, true);

    expect(tree[0].isExpanded).toBe(true);
    expect(tree[0].children![0].isExpanded).toBe(true);

    // Empty children branch
    const node: FileNode = { name: 'empty', path: 'empty', isDirectory: true, isExpanded: false, depth: 0 };
    FileTreeUtil.setAllExpanded([node], true);
    expect(node.isExpanded).toBe(true);
  });
});
