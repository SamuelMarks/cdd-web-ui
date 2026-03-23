import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CodeViewerComponent } from './code-viewer.component';
import { By } from '@angular/platform-browser';
import { Component, signal, forwardRef, Input } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { ThemeService } from '../../services/theme.service';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Monaco Editor to avoid dependency issues in isolated tests
@Component({
  selector: 'nu-monaco-editor',
  template: '<div>Mock Code Viewer Editor</div>',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MockMonacoEditorComponent),
      multi: true
    }
  ]
})
class MockMonacoEditorComponent implements ControlValueAccessor {
  @Input() options: unknown;
  @Input() model: unknown;
  writeValue(obj: unknown): void {}
  registerOnChange(fn: (val: unknown) => void): void {}
  registerOnTouched(fn: () => void): void {}
}

@Component({
  template: `
    <app-code-viewer 
      [activeFilePath]="activeFilePath()"
      [fileContent]="fileContent()"
      (fileSelected)="onFileSelected($event)">
    </app-code-viewer>
  `,
  imports: [CodeViewerComponent]
})
class TestHostComponent {
  activeFilePath = signal<string | null>(null);
  fileContent = signal<string | null>(null);
  
  lastSelected = '';
  onFileSelected(path: string) { this.lastSelected = path; }
}

describe('CodeViewerComponent', () => {
  let component: CodeViewerComponent;
  let fixture: ComponentFixture<CodeViewerComponent>;
  let notificationServiceMock: { success: import("vitest").Mock; error: import("vitest").Mock };
  let themeServiceMock: { isDarkTheme: import("@angular/core").WritableSignal<boolean> };
  let hostComponent: TestHostComponent;
  let hostFixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    notificationServiceMock = {
      success: vi.fn(),
      error: vi.fn(),
    };
    
    themeServiceMock = {
      isDarkTheme: signal(true)
    };

    await TestBed.configureTestingModule({
      imports: [CodeViewerComponent, TestHostComponent],
      providers: [
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: ThemeService, useValue: themeServiceMock },
      ]
    })
    .overrideComponent(CodeViewerComponent, {
      remove: {
        imports: [import('ngx-monaco-editor-v2').then(m => m.MonacoEditorModule) as unknown as import('@angular/core').Type<unknown>]
      },
      add: {
        imports: [MockMonacoEditorComponent]
      }
    })
    .compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
    hostFixture.detectChanges();
    
    component = hostFixture.debugElement.query(By.directive(CodeViewerComponent)).componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no file is selected', () => {
    const emptyState = hostFixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState).toBeTruthy();
  });

  it('should add a tab when activeFilePath is set', () => {
    hostComponent.activeFilePath.set('src/test.ts');
    hostComponent.fileContent.set('const a = 1;');
    hostFixture.detectChanges();

    expect(component.openTabs()).toContain('src/test.ts');
    
    const tabs = hostFixture.debugElement.queryAll(By.css('.tab'));
    expect(tabs.length).toBe(1);
    expect(tabs[0].nativeElement.textContent).toContain('test.ts');
  });

  it('should emit fileSelected when a different tab is clicked', () => {
    hostComponent.activeFilePath.set('src/test1.ts');
    hostFixture.detectChanges();
    
    // Manually add another tab for testing
    component.openTabs.set(['src/test1.ts', 'src/test2.ts']);
    hostFixture.detectChanges();

    const tabs = hostFixture.debugElement.queryAll(By.css('.tab'));
    tabs[1].triggerEventHandler('click', null);
    
    expect(hostComponent.lastSelected).toBe('src/test2.ts');
  });

  it('should not emit fileSelected if active tab is clicked', () => {
    hostComponent.activeFilePath.set('src/test1.ts');
    hostFixture.detectChanges();

    const tab = hostFixture.debugElement.query(By.css('.tab'));
    tab.triggerEventHandler('click', null);
    
    expect(hostComponent.lastSelected).toBe(''); // unchanged
  });

  it('should remove tab and select the last available tab on close', () => {
    component.openTabs.set(['src/test1.ts', 'src/test2.ts']);
    hostComponent.activeFilePath.set('src/test2.ts');
    hostFixture.detectChanges();

    const closeBtn = hostFixture.debugElement.queryAll(By.css('.tab-close'))[1];
    closeBtn.triggerEventHandler('click', new MouseEvent('click'));

    expect(component.openTabs()).toEqual(['src/test1.ts']);
    expect(hostComponent.lastSelected).toBe('src/test1.ts');
  });

  it('should not select a new tab if closing an inactive tab', () => {
    component.openTabs.set(['src/test1.ts', 'src/test2.ts']);
    hostComponent.activeFilePath.set('src/test2.ts'); // Active is test2
    hostComponent.lastSelected = ''; // reset
    hostFixture.detectChanges();

    // Close test1 (index 0)
    const closeBtn = hostFixture.debugElement.queryAll(By.css('.tab-close'))[0];
    closeBtn.triggerEventHandler('click', new MouseEvent('click'));

    expect(component.openTabs()).toEqual(['src/test2.ts']);
    expect(hostComponent.lastSelected).toBe(''); // We didn't emit because we closed an inactive tab
  });

  it('should emit empty string if the last active tab is closed', () => {
    component.openTabs.set(['src/test1.ts']);
    hostComponent.activeFilePath.set('src/test1.ts');
    hostFixture.detectChanges();

    const closeBtn = hostFixture.debugElement.query(By.css('.tab-close'));
    closeBtn.triggerEventHandler('click', new MouseEvent('click'));

    expect(component.openTabs()).toEqual([]);
    expect(hostComponent.lastSelected).toBe('');
  });

  it('should determine correct language based on extension', () => {
    expect(component.determineLanguage('file.ts')).toBe('typescript');
    expect(component.determineLanguage('file.tsx')).toBe('typescript');
    expect(component.determineLanguage('file.js')).toBe('javascript');
    expect(component.determineLanguage('file.jsx')).toBe('javascript');
    expect(component.determineLanguage('file.json')).toBe('json');
    expect(component.determineLanguage('file.yaml')).toBe('yaml');
    expect(component.determineLanguage('file.yml')).toBe('yaml');
    expect(component.determineLanguage('file.md')).toBe('markdown');
    expect(component.determineLanguage('file.html')).toBe('html');
    expect(component.determineLanguage('file.css')).toBe('css');
    expect(component.determineLanguage('file.scss')).toBe('scss');
    expect(component.determineLanguage('file.rs')).toBe('rust');
    expect(component.determineLanguage('file.go')).toBe('go');
    expect(component.determineLanguage('file.py')).toBe('python');
    expect(component.determineLanguage('file.rb')).toBe('ruby');
    expect(component.determineLanguage('file.java')).toBe('java');
    expect(component.determineLanguage('file.kt')).toBe('kotlin');
    expect(component.determineLanguage('file.kts')).toBe('kotlin');
    expect(component.determineLanguage('file.swift')).toBe('swift');
    expect(component.determineLanguage('file.cs')).toBe('csharp');
    expect(component.determineLanguage('file.cpp')).toBe('cpp');
    expect(component.determineLanguage('file.cc')).toBe('cpp');
    expect(component.determineLanguage('file.cxx')).toBe('cpp');
    expect(component.determineLanguage('file.h')).toBe('cpp');
    expect(component.determineLanguage('file.hpp')).toBe('cpp');
    expect(component.determineLanguage('file.c')).toBe('c');
    expect(component.determineLanguage('file.php')).toBe('php');
    expect(component.determineLanguage('file.sh')).toBe('shell');
    expect(component.determineLanguage('file.bash')).toBe('shell');
    expect(component.determineLanguage('file.txt')).toBe('plaintext');
    expect(component.determineLanguage('file_without_ext')).toBe('plaintext'); // Hit default case
  });

  it('should copy file content to clipboard', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    hostComponent.activeFilePath.set('src/test.ts');
    hostComponent.fileContent.set('const b = 2;');
    hostFixture.detectChanges();

    await component.copyToClipboard();
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const b = 2;');
    expect(notificationServiceMock.success).toHaveBeenCalledWith('Copied to clipboard.');
  });

  it('should handle clipboard copy failure', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.reject('error')),
      },
    });

    hostComponent.activeFilePath.set('src/test.ts');
    hostComponent.fileContent.set('const b = 2;');
    hostFixture.detectChanges();

    await component.copyToClipboard();
    
    expect(notificationServiceMock.error).toHaveBeenCalledWith('Failed to copy to clipboard.');
  });

  it('should do nothing on copy if no content', async () => {
    hostComponent.fileContent.set(null);
    hostFixture.detectChanges();

    await component.copyToClipboard();
    expect(notificationServiceMock.success).not.toHaveBeenCalled();
  });

  it('should download file content', () => {
    // Mock URL and a element
    const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:url');
    const revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    
    const mockAnchor = document.createElement('a');
    const clickSpy = vi.spyOn(mockAnchor, 'click').mockImplementation(() => {});
    
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') return mockAnchor;
      return originalCreateElement(tagName as string);
    });

    hostComponent.activeFilePath.set('src/test.ts');
    hostComponent.fileContent.set('const c = 3;');
    hostFixture.detectChanges();

    component.downloadFile();

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:url');
    expect(notificationServiceMock.success).toHaveBeenCalledWith('Downloading test.ts...');

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
  });

  it('should do nothing on download if no content or path', () => {
    hostComponent.fileContent.set(null);
    hostFixture.detectChanges();
    component.downloadFile();
    expect(notificationServiceMock.success).not.toHaveBeenCalled();
    
    hostComponent.fileContent.set('content');
    hostComponent.activeFilePath.set(null);
    hostFixture.detectChanges();
    component.downloadFile();
    expect(notificationServiceMock.success).not.toHaveBeenCalled();
  });

  it('should correctly configure editor options based on theme', () => {
    expect(component.editorOptions().theme).toBe('vs-dark');
    expect(component.editorOptions().readOnly).toBe(true);

    themeServiceMock.isDarkTheme.set(false);
    expect(component.editorOptions().theme).toBe('vs');
  });

  it('should extract filename correctly', () => {
    expect(component.getFilename('a/b/c.ts')).toBe('c.ts');
    expect(component.getFilename('c.ts')).toBe('c.ts');
    expect(component.getFilename('')).toBe(''); // empty string fallback
  });
});
