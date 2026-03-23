import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DirectoryTreeComponent } from './directory-tree.component';
import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import { GeneratedFile } from '../../services/wasm-worker.service';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
  template: `
    <app-directory-tree 
      [files]="files()"
      [activeFilePath]="activeFilePath()"
      [isExecuting]="isExecuting()"
      (fileSelected)="onFileSelected($event)">
    </app-directory-tree>
  `,
  imports: [DirectoryTreeComponent]
})
class TestHostComponent {
  files = signal<GeneratedFile[]>([]);
  activeFilePath = signal<string | null>(null);
  isExecuting = signal(false);
  
  lastSelected = '';
  onFileSelected(path: string) { this.lastSelected = path; }
}

describe('DirectoryTreeComponent', () => {
  let component: DirectoryTreeComponent;
  let fixture: ComponentFixture<DirectoryTreeComponent>;
  let hostComponent: TestHostComponent;
  let hostFixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DirectoryTreeComponent, TestHostComponent]
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
    hostFixture.detectChanges();
    
    component = hostFixture.debugElement.query(By.directive(DirectoryTreeComponent)).componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state initially', () => {
    const emptyState = hostFixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState).toBeTruthy();
  });

  it('should show loading skeleton when isExecuting is true', () => {
    hostComponent.isExecuting.set(true);
    hostFixture.detectChanges();
    const skeleton = hostFixture.debugElement.query(By.css('.loading-skeleton'));
    expect(skeleton).toBeTruthy();
  });

  it('should build and render tree when files are provided', () => {
    hostComponent.files.set([
      { path: 'src/index.ts', content: new Uint8Array() },
      { path: 'package.json', content: new Uint8Array() }
    ]);
    hostFixture.detectChanges();

    const nodes = hostFixture.debugElement.queryAll(By.css('.node'));
    expect(nodes.length).toBe(3); // src (folder), index.ts (file), package.json (file)
    
    // Check if the node's span has the right text
    const textContents = nodes.map(n => n.query(By.css('span'))?.nativeElement.textContent.trim());
    expect(textContents).toContain('src');
    expect(textContents).toContain('index.ts');
  });

  it('should toggle folder expansion on click', () => {
    hostComponent.files.set([{ path: 'src/index.ts', content: new Uint8Array() }]);
    hostFixture.detectChanges();

    const folderNode = hostFixture.debugElement.queryAll(By.css('.node'))[0];
    
    // Initially expanded
    expect(component.treeNodes()[0].isExpanded).toBe(true);

    folderNode.triggerEventHandler('click', null);
    hostFixture.detectChanges();

    // Now collapsed
    expect(component.treeNodes()[0].isExpanded).toBe(false);
    
    // File inside should be hidden
    const nodesAfter = hostFixture.debugElement.queryAll(By.css('.node'));
    expect(nodesAfter.length).toBe(1); // Only the folder is visible
  });

  it('should emit fileSelected when a file is clicked', () => {
    hostComponent.files.set([{ path: 'src/index.ts', content: new Uint8Array() }]);
    hostFixture.detectChanges();

    const fileNode = hostFixture.debugElement.queryAll(By.css('.node'))[1]; // second node is index.ts
    fileNode.triggerEventHandler('click', null);
    
    expect(hostComponent.lastSelected).toBe('src/index.ts');
  });

  it('should highlight active file', () => {
    hostComponent.files.set([{ path: 'src/index.ts', content: new Uint8Array() }]);
    hostComponent.activeFilePath.set('src/index.ts');
    hostFixture.detectChanges();

    const fileNode = hostFixture.debugElement.queryAll(By.css('.node.active'));
    expect(fileNode.length).toBe(1);
    expect(fileNode[0].nativeElement.textContent).toContain('index.ts');
  });

  it('should expand and collapse all', () => {
    hostComponent.files.set([{ path: 'src/app/index.ts', content: new Uint8Array() }]);
    hostFixture.detectChanges();

    // Initial state: expanded
    expect(component.treeNodes()[0].isExpanded).toBe(true);
    
    component.collapseAll();
    hostFixture.detectChanges();
    expect(component.treeNodes()[0].isExpanded).toBe(false);

    component.expandAll();
    hostFixture.detectChanges();
    expect(component.treeNodes()[0].isExpanded).toBe(true);
  });

  it('should map file icons correctly', () => {
    expect(component.getFileIcon('test.ts')).toBe('javascript');
    expect(component.getFileIcon('test.js')).toBe('javascript');
    expect(component.getFileIcon('test.json')).toBe('data_object');
    expect(component.getFileIcon('test.md')).toBe('description');
    expect(component.getFileIcon('test.rs')).toBe('code');
    expect(component.getFileIcon('test.py')).toBe('code');
    expect(component.getFileIcon('test.go')).toBe('code');
    expect(component.getFileIcon('test.txt')).toBe('insert_drive_file');
  });
});
