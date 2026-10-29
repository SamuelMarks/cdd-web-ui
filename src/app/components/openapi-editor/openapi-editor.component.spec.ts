import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { OpenApiEditorComponent } from './openapi-editor.component';

import { Component, signal, forwardRef } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { ThemeService } from '../../services/theme.service';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the ngx-monaco-editor-v2 component completely to avoid module provider issues in standalone tests
@Component({
  selector: 'ngx-monaco-editor',
  template: '<div>Mock Monaco Editor</div>',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MockMonacoEditorComponent),
      multi: true,
    },
  ],
})
class MockMonacoEditorComponent implements ControlValueAccessor {
  writeValue(_obj: unknown): void {
    void _obj;
  }
  registerOnChange(_fn: (v: unknown) => void): void {
    void _fn;
  }
  registerOnTouched(_fn: () => void): void {
    void _fn;
  }
}

@Component({
  template: `
    <app-openapi-editor
      [specContent]="specContent()"
      (specContentChange)="onContentChange($event)"
      (validationErrorsChange)="onErrorsChange($event)"
    >
    </app-openapi-editor>
  `,
  imports: [OpenApiEditorComponent],
})
class TestHostComponent {
  specContent = signal('openapi: 3.0.0');
  lastContent = '';
  lastErrors: string[] = [];

  onContentChange(content: string) {
    this.lastContent = content;
  }
  onErrorsChange(errors: string[]) {
    this.lastErrors = errors;
  }
}

describe('OpenApiEditorComponent', () => {
  let component: OpenApiEditorComponent;
  let fixture: ComponentFixture<OpenApiEditorComponent>;
  let notificationServiceMock: { error: import('vitest').Mock; success: import('vitest').Mock };
  let themeServiceMock: { isDarkTheme: import('@angular/core').WritableSignal<boolean> };

  beforeEach(async () => {
    notificationServiceMock = {
      success: vi.fn(),
      error: vi.fn(),
    };

    themeServiceMock = {
      isDarkTheme: signal(true),
    };

    await TestBed.configureTestingModule({
      imports: [OpenApiEditorComponent, TestHostComponent, FormsModule],
      providers: [
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: ThemeService, useValue: themeServiceMock },
      ],
    })
      // Override the import of MonacoEditorModule to use our mock
      .overrideComponent(OpenApiEditorComponent, {
        remove: {
          imports: [
            /* we would remove the real one here but standalone makes it tricky, instead we override the whole template if needed, or we just rely on NO_ERRORS_SCHEMA or mock component. Let's use override to swap the component import */
          ],
        },
        add: { imports: [MockMonacoEditorComponent] },
      })
      .compileComponents();

    // Re-override properly by clearing the real import
    TestBed.overrideComponent(OpenApiEditorComponent, {
      remove: { imports: [MonacoEditorModule] },
      add: { imports: [MockMonacoEditorComponent] },
    });

    fixture = TestBed.createComponent(OpenApiEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput(
      'specContent',
      'openapi: 3.0.0\ninfo:\n  title: Test\n  version: "1.0"\npaths: {}',
    );
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize internalContent from input', () => {
    expect(component.internalContent()).toContain('openapi: 3.0.0');
  });

  it('should update editorOptions based on theme', () => {
    expect(component.editorOptions().theme).toBe('vs-dark');
  });

  it('should format valid YAML document', () => {
    component.internalContent.set('openapi: "3.0.0"\ninfo: \n  title: "test"\n  version: "1"');
    component.formatDocument();
    expect(notificationServiceMock.success).toHaveBeenCalledWith(
      'Document formatted successfully.',
    );
    expect(component.internalContent()).toContain('openapi: 3.0.0'); // formatted by js-yaml
  });

  it('should format valid JSON document', () => {
    component.internalContent.set('{"openapi":"3.0.0","info":{"title":"test","version":"1"}}');
    component.formatDocument();
    expect(notificationServiceMock.success).toHaveBeenCalledWith(
      'Document formatted successfully.',
    );
    expect(component.internalContent()).toContain('{\n  "openapi": "3.0.0"'); // nicely formatted JSON
  });

  it('should update internalContent when form control value changes', () => {
    const emitSpy = vi.spyOn(component.specContentChange, 'emit');
    const validateSpy = vi.spyOn(
      component as unknown as { validateContent: (c: string) => void },
      'validateContent',
    );

    // Test null value fallback
    component.contentControl.setValue(null);
    expect(component.internalContent()).toBe('');

    // Simulate setting form control value from UI
    component.contentControl.setValue('openapi: 3.1.0\ninfo:\n  title: "Test"\n  version: 1.0.0');

    expect(component.internalContent()).toContain('openapi: 3.1.0');
    expect(emitSpy).toHaveBeenCalledWith(
      'openapi: 3.1.0\ninfo:\n  title: "Test"\n  version: 1.0.0',
    );
    expect(validateSpy).toHaveBeenCalledWith(
      'openapi: 3.1.0\ninfo:\n  title: "Test"\n  version: 1.0.0',
    );

    // Set same value to cover the false branch
    emitSpy.mockClear();
    validateSpy.mockClear();
    component.contentControl.setValue('openapi: 3.1.0\ninfo:\n  title: "Test"\n  version: 1.0.0');
    expect(emitSpy).not.toHaveBeenCalled();
    expect(validateSpy).not.toHaveBeenCalled();
  });

  it('should show error when formatting invalid document', () => {
    component.internalContent.set('{ "openapi": "3.0.0", "info": }');
    component.formatDocument();
    expect(notificationServiceMock.error).toHaveBeenCalledWith('Cannot format invalid document.');
  });

  it('should clear editor', () => {
    component.clearEditor();
    expect(component.internalContent()).toBe('');
  });

  it('should copy to clipboard on success', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    component.internalContent.set('test');
    await component.copyToClipboard();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test');
    expect(notificationServiceMock.success).toHaveBeenCalledWith('Copied to clipboard.');
  });

  it('should show error if clipboard fails', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.reject(new Error('error'))),
      },
    });

    component.internalContent.set('test');
    await component.copyToClipboard();
    expect(notificationServiceMock.error).toHaveBeenCalledWith('Failed to copy to clipboard.');
  });

  it('should do nothing on format if empty', () => {
    component.internalContent.set('   ');
    component.formatDocument();
    expect(notificationServiceMock.success).not.toHaveBeenCalled();
    expect(notificationServiceMock.error).not.toHaveBeenCalled();
  });

  it('should do nothing on copy if empty', async () => {
    component.internalContent.set('');
    await component.copyToClipboard();
    expect(notificationServiceMock.success).not.toHaveBeenCalled();
  });

  it('should capture editor init', () => {
    const mockEditor = { id: 1 };
    component.onEditorInit(mockEditor);
    expect((component as unknown as Record<string, unknown>)['editorInstance']).toBe(mockEditor);
  });

  it('should correctly configure editor options based on theme', () => {
    expect(component.editorOptions().theme).toBe('vs-dark');
    themeServiceMock.isDarkTheme.set(false);
    expect(component.editorOptions().theme).toBe('vs');
  });

  it('should correctly configure editor language based on content', () => {
    // Force set internal to test determineLanguage
    component.internalContent.set('{"key":"value"}');
    expect(component.editorOptions().language).toBe('json');

    component.internalContent.set('key: value');
    expect(component.editorOptions().language).toBe('yaml');
  });

  it('should not update internal content if external content is the same', () => {
    // Set directly internal
    component.internalContent.set('same');
    // Now trigger external to be 'same'
    fixture.componentRef.setInput('specContent', 'same');
    fixture.detectChanges();

    // Should be 'same' (not reset or anything)
    expect(component.internalContent()).toBe('same');
  });

  it('should handle S keydown correctly when not shift', () => {
    const emitSpy = vi.spyOn(component.runClicked, 'emit');
    const event = new KeyboardEvent('keydown', { key: 's', shiftKey: false, ctrlKey: true });
    vi.spyOn(event, 'preventDefault');

    component.handleKeydown(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should ignore S keydown if shift is pressed', () => {
    const emitSpy = vi.spyOn(component.runClicked, 'emit');
    const event = new KeyboardEvent('keydown', { key: 's', shiftKey: true, ctrlKey: true });
    vi.spyOn(event, 'preventDefault');

    component.handleKeydown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should ignore other keys', () => {
    const emitSpy = vi.spyOn(component.runClicked, 'emit');
    const event = new KeyboardEvent('keydown', { key: 'a', shiftKey: false, ctrlKey: true });
    vi.spyOn(event, 'preventDefault');

    component.handleKeydown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should not emit runClicked on keydown if isExecuting', () => {
    const emitSpy = vi.spyOn(component.runClicked, 'emit');
    fixture.componentRef.setInput('isExecuting', true);
    const event = new KeyboardEvent('keydown', { key: 's', shiftKey: false, ctrlKey: true });

    component.handleKeydown(event);

    expect(emitSpy).not.toHaveBeenCalled();
  });

  describe('Tabs & URLs mode interactions', () => {
    it('should compute selectedTabIndex, hasNonEmptyUrls, and hasLoadedUrls from inputs', () => {
      expect(component.selectedTabIndex()).toBe(0);
      expect(component.hasNonEmptyUrls()).toBe(false);
      expect(component.hasLoadedUrls()).toBe(false);

      fixture.componentRef.setInput('activeMode', 'urls');
      fixture.componentRef.setInput('specUrls', [
        { id: 'u1', url: 'https://example.com/1.yaml', status: 'loaded', content: 'openapi: 3.0' },
        { id: 'u2', url: 'https://example.com/2.yaml', status: 'loading' },
        { id: 'u3', url: 'https://example.com/3.yaml', status: 'error', error: 'Failed' },
        { id: 'u4', url: '', status: 'idle' },
      ]);
      fixture.detectChanges();

      expect(component.selectedTabIndex()).toBe(1);
      expect(component.hasNonEmptyUrls()).toBe(true);
      expect(component.hasLoadedUrls()).toBe(true);
    });

    it('should emit activeModeChange and refresh editor layout when switching tabs', () => {
      const modeSpy = vi.spyOn(component.activeModeChange, 'emit');
      const layoutSpy = vi.fn();
      component.onEditorInit({ layout: layoutSpy });

      component.onTabIndexChange(1);
      expect(modeSpy).toHaveBeenCalledWith('urls');
      expect(layoutSpy).not.toHaveBeenCalled();

      component.onTabIndexChange(0);
      expect(modeSpy).toHaveBeenCalledWith('editor');
      expect(layoutSpy).toHaveBeenCalled();
    });

    it('should handle refreshEditorLayout gracefully when editorInstance has no layout method', () => {
      component.onEditorInit(null);
      expect(() => component.onTabIndexChange(0)).not.toThrow();
    });

    it('should emit urlAdded, urlUpdated, urlRemoved, urlsClearClicked, and fetchUrlsClicked', () => {
      const addSpy = vi.spyOn(component.urlAdded, 'emit');
      const updateSpy = vi.spyOn(component.urlUpdated, 'emit');
      const removeSpy = vi.spyOn(component.urlRemoved, 'emit');
      const clearSpy = vi.spyOn(component.urlsClearClicked, 'emit');
      const fetchSpy = vi.spyOn(component.fetchUrlsClicked, 'emit');

      component.onAddUrl('https://example.com/spec.json');
      expect(addSpy).toHaveBeenCalledWith('https://example.com/spec.json');

      const inputEl = document.createElement('input');
      inputEl.value = 'https://example.com/updated.json';
      const inputEvent = new Event('input');
      Object.defineProperty(inputEvent, 'target', { value: inputEl });
      component.onUrlInput('u1', inputEvent);
      expect(updateSpy).toHaveBeenCalledWith({
        id: 'u1',
        url: 'https://example.com/updated.json',
      });

      const emptyTargetEvent = new Event('input');
      Object.defineProperty(emptyTargetEvent, 'target', { value: null });
      component.onUrlInput('u1', emptyTargetEvent);
      expect(updateSpy).toHaveBeenCalledWith({ id: 'u1', url: '' });

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      vi.spyOn(enterEvent, 'preventDefault');
      component.onUrlEnterKey('u1', enterEvent);
      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledWith(['u1']);

      component.onFetchAllUrls();
      expect(fetchSpy).toHaveBeenCalledWith(undefined);

      component.onRemoveUrl('u1');
      expect(removeSpy).toHaveBeenCalledWith('u1');

      component.onClearUrls();
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should split multi-line pasted URLs into urlUpdated and multiple urlAdded emissions', () => {
      const updateSpy = vi.spyOn(component.urlUpdated, 'emit');
      const addSpy = vi.spyOn(component.urlAdded, 'emit');

      const multiLinePaste = {
        clipboardData: {
          getData: () =>
            'https://example.com/1.yaml\nhttps://example.com/2.yaml\r\nhttps://example.com/3.yaml',
        },
        preventDefault: vi.fn(),
      } as unknown as ClipboardEvent;

      component.onUrlPaste('u1', multiLinePaste);

      expect(multiLinePaste.preventDefault).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith({ id: 'u1', url: 'https://example.com/1.yaml' });
      expect(addSpy).toHaveBeenCalledTimes(2);
      expect(addSpy).toHaveBeenNthCalledWith(1, 'https://example.com/2.yaml');
      expect(addSpy).toHaveBeenNthCalledWith(2, 'https://example.com/3.yaml');
    });

    it('should ignore single-line or empty paste events', () => {
      const updateSpy = vi.spyOn(component.urlUpdated, 'emit');

      const singleLinePaste = {
        clipboardData: { getData: () => 'https://example.com/single.yaml' },
        preventDefault: vi.fn(),
      } as unknown as ClipboardEvent;
      component.onUrlPaste('u1', singleLinePaste);
      expect(updateSpy).not.toHaveBeenCalled();

      const singleLineWithTrailingNewline = {
        clipboardData: { getData: () => 'https://example.com/single.yaml\n   ' },
        preventDefault: vi.fn(),
      } as unknown as ClipboardEvent;
      component.onUrlPaste('u1', singleLineWithTrailingNewline);
      expect(updateSpy).not.toHaveBeenCalled();

      const nullClipboardPaste = {
        clipboardData: null,
        preventDefault: vi.fn(),
      } as unknown as ClipboardEvent;
      component.onUrlPaste('u1', nullClipboardPaste);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should switch to editor and refresh layout on onPreviewInEditor', () => {
      const modeSpy = vi.spyOn(component.activeModeChange, 'emit');
      const layoutSpy = vi.fn();
      component.onEditorInit({ layout: layoutSpy });

      component.onPreviewInEditor();
      expect(modeSpy).toHaveBeenCalledWith('editor');
      expect(layoutSpy).toHaveBeenCalled();
    });
  });
});
