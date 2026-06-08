import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiDocsViewerComponent } from './api-docs-viewer.component';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { AppState } from '../../store/state';
import {
  selectOpenApiSpecContent,
  selectGeneratedFiles,
  selectSelectedLanguageId,
} from '../../store/selectors';
import * as WorkspaceActions from '../../store/actions';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeService } from '../../services/theme.service';
import { signal } from '@angular/core';

describe('ApiDocsViewerComponent', () => {
  let component: ApiDocsViewerComponent;
  let fixture: ComponentFixture<ApiDocsViewerComponent>;
  let store: MockStore<AppState>;
  let themeServiceMock: { isDarkTheme: ReturnType<typeof signal<boolean>> };

  beforeEach(async () => {
    themeServiceMock = { isDarkTheme: signal(false) };
    await TestBed.configureTestingModule({
      imports: [ApiDocsViewerComponent],
      providers: [
        {
          provide: ThemeService,
          useValue: themeServiceMock,
        },
        provideMockStore({
          selectors: [
            { selector: selectOpenApiSpecContent, value: 'openapi: 3.0.0\ninfo:\n  title: Test' },
            { selector: selectGeneratedFiles, value: [] },
            { selector: selectSelectedLanguageId, value: 'cdd-ts' },
          ],
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApiDocsViewerComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should dispatch apiDocsIframeLoaded on init (dummy to clear state)', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    component.ngOnInit();
    expect(dispatchSpy).toHaveBeenCalledWith(WorkspaceActions.apiDocsIframeLoaded());
  });

  it('should dispatch setApiDocsVisibility on retryLoad', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    component.retryLoad();
    expect(dispatchSpy).toHaveBeenCalledWith(
      WorkspaceActions.setApiDocsVisibility({ visible: true }),
    );
  });

  it('should return correct theme string based on isDarkTheme', () => {
    expect(component.theme()).toBe('light');
    themeServiceMock.isDarkTheme.set(true);
    expect(component.theme()).toBe('dark');
  });

  it('should map generated files to sdkExamples using selected language (including docs.json)', () => {
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new TextEncoder().encode('{"endpoints": {}}') },
    ]);
    store.overrideSelector(selectSelectedLanguageId, 'cdd-go');
    store.refreshState();
    fixture.detectChanges();

    const examples = component.mappedSdkExamples();
    expect(examples.length).toBe(1);
    expect(examples[0].language).toBe('go');
    expect(examples[0].filepath).toBe('docs.json');
    expect(examples[0].content).toContain('endpoints');
  });

  it('should map sdk examples correctly dynamically based on language', () => {
    store.overrideSelector(selectSelectedLanguageId, 'cdd-ruby');
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'test.rb', content: new Uint8Array([116, 101, 115, 116]) },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()).toEqual([
      { language: 'ruby', filepath: 'test.rb', content: 'test' },
    ]);
  });

  it('should fallback to typescript if !langId', () => {
    store.overrideSelector(selectSelectedLanguageId, '');
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'test.ts', content: new Uint8Array([116, 101, 115, 116]) },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()).toEqual([
      { language: 'typescript', filepath: 'test.ts', content: 'test' },
    ]);
  });

  it('should normalize cdd-python-all to python', () => {
    store.overrideSelector(selectSelectedLanguageId, 'cdd-python-all');
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'test.py', content: new Uint8Array([116, 101, 115, 116]) },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()).toEqual([
      { language: 'python', filepath: 'test.py', content: 'test' },
    ]);
  });

  it('should normalize cdd-sh to bash', () => {
    store.overrideSelector(selectSelectedLanguageId, 'cdd-sh');
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'test.sh', content: new Uint8Array([116, 101, 115, 116]) },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()).toEqual([
      { language: 'bash', filepath: 'test.sh', content: 'test' },
    ]);
  });
});
