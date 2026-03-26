import { TestBed, ComponentFixture } from '@angular/core/testing';
import { WorkspaceComponent } from './workspace.component';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { AppState } from '../../store/state';
import { initialWorkspaceState, initialFileTreeState, initialOpenApiState } from '../../store/reducers';
import * as Selectors from '../../store/selectors';
import * as Actions from '../../store/actions';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Component, input, output } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeService } from '../../services/theme.service';
import { NotificationService } from '../../services/notification.service';
import { LanguageService } from '../../services/language.service';
import { OfflineService } from '../../services/offline.service';
import { StorageService } from '../../services/storage.service';
import { SplitPaneComponent } from '../../components/split-pane/split-pane.component';
import { OpenApiEditorComponent } from '../../components/openapi-editor/openapi-editor.component';
import { DirectoryTreeComponent } from '../../components/directory-tree/directory-tree.component';
import { CodeViewerComponent } from '../../components/code-viewer/code-viewer.component';
import { LanguageSelectorComponent } from '../../components/language-selector/language-selector.component';
import { BottomPanelComponent } from '../../components/bottom-panel/bottom-panel.component';
import { PETSTORE_SPEC, HELLO_WORLD_SPEC } from '../../models/examples';

// We mock the child components so we just test the orchestration layer without heavy Monaco dependencies
@Component({ selector: 'app-split-pane', template: '<div></div>' })
class MockSplitPaneComponent {
  orientation = input<'openapi-left' | 'openapi-right'>();
  isExecuting = input<boolean>();
  leftTemplate = input<TemplateRef<void>>();
  rightTemplate = input<TemplateRef<void>>();
  swapClicked = output<void>();
  runClicked = output<void>();
}

@Component({ selector: 'app-openapi-editor', template: '<div></div>' })
class MockOpenApiEditorComponent {
  specContent = input<string>();
}

@Component({ selector: 'app-directory-tree', template: '<div></div>' })
class MockDirectoryTreeComponent {
  files = input<object[]>();
  activeFilePath = input<string | null>();
  isExecuting = input<boolean>();
}

@Component({ selector: 'app-code-viewer', template: '<div></div>' })
class MockCodeViewerComponent {
  activeFilePath = input<string | null>();
  fileContent = input<string | null>();
}

@Component({ selector: 'app-language-selector', template: '<div></div>' })
class MockLanguageSelectorComponent {
  selectedLanguageId = input<string>();
  target = input<string>();
  options = input<Record<string, string | boolean | number>>();
}

@Component({ selector: 'app-bottom-panel', template: '<div></div>' })
class MockBottomPanelComponent {}

describe('WorkspaceComponent', () => {
  let component: WorkspaceComponent;
  let fixture: ComponentFixture<WorkspaceComponent>;
  let store: MockStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        WorkspaceComponent, 
        NoopAnimationsModule
      ],
      providers: [
        provideMockStore({
          initialState: {
            workspace: initialWorkspaceState,
            fileTree: initialFileTreeState,
            openApi: initialOpenApiState,
          },
          selectors: [
            { selector: Selectors.selectOrientation, value: 'openapi-left' },
            { selector: Selectors.selectIsExecuting, value: false },
            { selector: Selectors.selectSelectedLanguageId, value: 'typescript' },
            { selector: Selectors.selectTarget, value: 'to_sdk' },
            { selector: Selectors.selectCurrentLanguageOptions, value: {} },
            { selector: Selectors.selectOpenApiSpecContent, value: 'spec' },
            { selector: Selectors.selectOpenApiInputFormat, value: 'openapi_3_2_0' },
            { selector: Selectors.selectGeneratedFiles, value: [] },
            { selector: Selectors.selectActiveFilePath, value: null },
            { selector: Selectors.selectActiveFileContent, value: null },
          ]
        }),
        { provide: ThemeService, useValue: { isDarkTheme: () => false } },
        { provide: NotificationService, useValue: {} },
        { provide: LanguageService, useValue: { languages: () => [] } },
        { provide: OfflineService, useValue: { isOnline: () => true } },
        { provide: StorageService, useValue: { getItem: () => null, setItem: () => {} } }
      ]
    })
    .overrideComponent(WorkspaceComponent, {
      remove: {
        imports: [
          SplitPaneComponent,
          OpenApiEditorComponent,
          DirectoryTreeComponent,
          CodeViewerComponent,
          LanguageSelectorComponent,
          BottomPanelComponent
        ]
      },
      add: {
        imports: [
          MockSplitPaneComponent,
          MockOpenApiEditorComponent,
          MockDirectoryTreeComponent,
          MockCodeViewerComponent,
          MockLanguageSelectorComponent,
          MockBottomPanelComponent
        ]
      }
    })
    .compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(WorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should dispatch toggleOrientation on swap', () => {
    const spy = vi.spyOn(store, 'dispatch');
    component.onSwap();
    expect(spy).toHaveBeenCalledWith(Actions.toggleOrientation());
  });

  it('should dispatch executeRun on run', () => {
    const spy = vi.spyOn(store, 'dispatch');
    component.onRun();
    expect(spy).toHaveBeenCalledWith(Actions.executeRun());
  });

  it('should dispatch setSelectedLanguage when language changes', () => {
    const spy = vi.spyOn(store, 'dispatch');
    component.onLanguageChanged('rust');
    expect(spy).toHaveBeenCalledWith(Actions.setSelectedLanguage({ languageId: 'rust' }));
  });

  it('should dispatch updateOpenApiSpec on spec change', () => {
    const spy = vi.spyOn(store, 'dispatch');
    component.onSpecContentChange('new spec');
    expect(spy).toHaveBeenCalledWith(Actions.updateOpenApiSpec({ content: 'new spec' }));
  });

  it('should dispatch setOpenApiValidationErrors on validation error change', () => {
    const spy = vi.spyOn(store, 'dispatch');
    component.onValidationErrorsChange(['error 1']);
    expect(spy).toHaveBeenCalledWith(Actions.setOpenApiValidationErrors({ errors: ['error 1'] }));
  });

  it('should dispatch selectFile on file selection', () => {
    const spy = vi.spyOn(store, 'dispatch');
    component.onFileSelected('src/test.ts');
    expect(spy).toHaveBeenCalledWith(Actions.selectFile({ filePath: 'src/test.ts' }));
  });

  it('should dispatch setTarget on target change', () => {
    const spy = vi.spyOn(store, 'dispatch');
    component.onTargetChanged('to_server');
    expect(spy).toHaveBeenCalledWith(Actions.setTarget({ target: 'to_server' }));
  });

  it('should dispatch setLanguageOptions on options change', () => {
    const spy = vi.spyOn(store, 'dispatch');
    const options = { framework: 'angular' };
    component.onOptionsChanged({ languageId: 'typescript', options });
    expect(spy).toHaveBeenCalledWith(Actions.setLanguageOptions({ languageId: 'typescript', options }));
  });

  it('should dispatch setInputFormat on input format change', () => {
    const spy = vi.spyOn(store, 'dispatch');
    component.onInputFormatChange('google_discovery');
    expect(spy).toHaveBeenCalledWith(Actions.setInputFormat({ format: 'google_discovery' }));
  });

  it('should compute selectedExample based on spec content', () => {
    store.overrideSelector(Selectors.selectOpenApiSpecContent, PETSTORE_SPEC);
    store.refreshState();
    fixture.detectChanges();
    expect(component.selectedExample()).toBe('petstore');

    store.overrideSelector(Selectors.selectOpenApiSpecContent, HELLO_WORLD_SPEC);
    store.refreshState();
    fixture.detectChanges();
    expect(component.selectedExample()).toBe('hello');

    store.overrideSelector(Selectors.selectOpenApiSpecContent, 'some custom spec');
    store.refreshState();
    fixture.detectChanges();
    expect(component.selectedExample()).toBe('custom');
  });

  it('should dispatch updateOpenApiSpec on example change', () => {
    const spy = vi.spyOn(store, 'dispatch');
    
    component.onExampleChange('petstore');
    expect(spy).toHaveBeenCalledWith(Actions.updateOpenApiSpec({ content: PETSTORE_SPEC }));
    
    component.onExampleChange('hello');
    expect(spy).toHaveBeenCalledWith(Actions.updateOpenApiSpec({ content: HELLO_WORLD_SPEC }));
    
    spy.mockClear();
    component.onExampleChange('custom');
    expect(spy).not.toHaveBeenCalled();
  });


  describe('API Docs pane controls', () => {
    it('should dispatch toggleApiDocsPane on toggleApiDocs', () => {
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      component.toggleApiDocs();
      expect(dispatchSpy).toHaveBeenCalledWith(Actions.toggleApiDocsPane());
    });

    it('should dispatch toggleApiDocsPane on Ctrl+Shift+D keyboard shortcut', () => {
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, shiftKey: true });
      component.handleKeyboardEvent(event);
      expect(dispatchSpy).toHaveBeenCalledWith(Actions.toggleApiDocsPane());
    });

    it('should not toggle API docs pane on irrelevant keyboard shortcut', () => {
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: false, shiftKey: false });
      component.handleKeyboardEvent(event);
      expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: '[Workspace] Toggle API Docs Pane' }));
    });

    it('should dispatch resizeApiDocsPane on resizer double click', () => {
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      component.onResizerDoubleClick();
      expect(dispatchSpy).toHaveBeenCalledWith(Actions.resizeApiDocsPane({ height: 300 }));
    });

    it('should dispatch resizeApiDocsPane on resizer ArrowUp keydown', () => {
      vi.spyOn(component, 'apiDocsPaneHeight').mockReturnValue(300);
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      component.onResizerKeydown(event);
      expect(dispatchSpy).toHaveBeenCalledWith(Actions.resizeApiDocsPane({ height: 320 }));
    });

    it('should dispatch resizeApiDocsPane on resizer ArrowDown keydown with minimum height constraint', () => {
      vi.spyOn(component, 'apiDocsPaneHeight').mockReturnValue(160);
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      component.onResizerKeydown(event);
      expect(dispatchSpy).toHaveBeenCalledWith(Actions.resizeApiDocsPane({ height: 150 }));
    });

    it('should ignore irrelevant keys on vertical resizer', () => {
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      component.onResizerKeydown(event);
      expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: '[Workspace] Resize Bottom Pane' }));
    });

    it('should dispatch resizeApiDocsPane during drag (mousemove)', () => {
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      vi.spyOn(component, 'apiDocsPaneHeight').mockReturnValue(300);

      const mousedownEvent = new MouseEvent('mousedown', { clientY: 500 });
      component.onResizerMouseDown(mousedownEvent);

      const mousemoveEvent = new MouseEvent('mousemove', { clientY: 400 });
      document.dispatchEvent(mousemoveEvent);

      expect(dispatchSpy).toHaveBeenCalledWith(Actions.resizeApiDocsPane({ height: 400 }));

      const mouseupEvent = new MouseEvent('mouseup');
      document.dispatchEvent(mouseupEvent);
    });
  });

});
