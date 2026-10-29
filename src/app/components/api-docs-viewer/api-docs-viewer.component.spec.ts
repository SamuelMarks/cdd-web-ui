import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiDocsViewerComponent } from './api-docs-viewer.component';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { AppState } from '../../store/state';
import {
  selectOpenApiSpecContent,
  selectGeneratedFiles,
  selectSelectedLanguageId,
  selectCurrentLanguageOptions,
} from '../../store/selectors';
import * as WorkspaceActions from '../../store/actions';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeService } from '../../services/theme.service';
import { WasmWorkerService } from '../../services/wasm-worker.service';
import { LanguageService } from '../../services/language.service';
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
        {
          provide: WasmWorkerService,
          useValue: { generateCode: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: LanguageService,
          useValue: { languages: vi.fn().mockReturnValue([]) },
        },
        provideMockStore({
          selectors: [
            { selector: selectOpenApiSpecContent, value: 'openapi: 3.0.0\ninfo:\n  title: Test' },
            { selector: selectGeneratedFiles, value: [] },
            { selector: selectSelectedLanguageId, value: 'cdd-ts' },
            { selector: selectCurrentLanguageOptions, value: {} },
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

  it('should unwrap array-wrapped docs.json containing endpoints, workflows, or webhooks and ignore invalid/non-matching arrays', () => {
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new TextEncoder().encode('[{"endpoints": {"/pet": {}}}]') },
    ]);
    store.overrideSelector(selectSelectedLanguageId, 'cdd-rust');
    store.refreshState();
    expect(component.mappedSdkExamples()[0].content).toBe('{"endpoints":{"/pet":{}}}');

    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new TextEncoder().encode('[{"workflows": {}}]') },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()[0].content).toBe('{"workflows":{}}');

    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new TextEncoder().encode('[{"webhooks": {}}]') },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()[0].content).toBe('{"webhooks":{}}');

    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new TextEncoder().encode('[{"operations": []}]') },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()[0].content).toBe('[{"operations": []}]');

    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new TextEncoder().encode('[invalid json') },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()[0].content).toBe('[invalid json');
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

  it('should fetch and cache to_docs_json snippets when WasmWorkerService and LanguageService are provided', async () => {
    // 1. Test early returns in onDocsLanguageChange
    component.onDocsLanguageChange(new CustomEvent('cdd-language-change', { detail: {} }));
    component.onDocsLanguageChange(
      new CustomEvent('cdd-language-change', { detail: { language: 'bash' } }),
    );
    store.overrideSelector(selectOpenApiSpecContent, '');
    store.refreshState();
    fixture.detectChanges();
    component.onDocsLanguageChange(
      new CustomEvent('cdd-language-change', { detail: { language: 'ruby' } }),
    );

    // 2. Test with WasmWorkerService and LanguageService injected
    TestBed.resetTestingModule();
    const generateCodeMock = vi.fn().mockResolvedValue([
      {
        path: 'docs.json',
        content: new TextEncoder().encode('{"endpoints":{"/pets":{"get":"puts 1"}}}'),
      },
    ]);
    const languageServiceMock = {
      languages: vi.fn().mockReturnValue([
        { id: 'ruby', name: 'Ruby', repo: 'cdd-ruby', availableInWasm: true },
        { id: 'sh', name: 'Shell', repo: 'cdd-sh', availableInWasm: true },
        { id: 'offline', name: 'Offline', repo: 'cdd-offline', availableInWasm: false },
      ]),
    };

    await TestBed.configureTestingModule({
      imports: [ApiDocsViewerComponent],
      providers: [
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: WasmWorkerService, useValue: { generateCode: generateCodeMock } },
        { provide: LanguageService, useValue: languageServiceMock },
        provideMockStore({
          selectors: [
            {
              selector: selectOpenApiSpecContent,
              value: '{"openapi":"3.0.0","info":{"title":"T","version":"1"}}',
            },
            { selector: selectGeneratedFiles, value: [] },
            { selector: selectSelectedLanguageId, value: 'ruby' },
            { selector: selectCurrentLanguageOptions, value: undefined },
          ],
        }),
      ],
    }).compileComponents();

    const fix2 = TestBed.createComponent(ApiDocsViewerComponent);
    const comp2 = fix2.componentInstance;
    const store2 = TestBed.inject(MockStore);
    fix2.detectChanges();
    await new Promise((r) => setTimeout(r, 10));

    expect(generateCodeMock).toHaveBeenCalledWith(
      'cdd-ruby',
      '{"openapi":"3.0.0","info":{"title":"T","version":"1"}}',
      'to_docs_json',
      {},
    );
    expect(
      comp2.mappedSdkExamples().some((e) => e.language === 'ruby' && e.filepath === 'docs.json'),
    ).toBe(true);

    // Deduplicate if store already has docs.json for ruby
    store2.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new TextEncoder().encode('{"endpoints":{}}') },
    ]);
    store2.refreshState();
    expect(
      comp2.mappedSdkExamples().filter((e) => e.language === 'ruby' && e.filepath === 'docs.json')
        .length,
    ).toBe(1);

    // Language not found / not availableInWasm
    await comp2.fetchDocsJsonForLanguage('unknown', '{}');
    await comp2.fetchDocsJsonForLanguage('offline', '{}');

    // No docs.json returned from worker
    generateCodeMock.mockResolvedValueOnce([{ path: 'README.md', content: new Uint8Array() }]);
    await comp2.fetchDocsJsonForLanguage('ruby', '{}');

    // Worker throws error
    generateCodeMock.mockRejectedValueOnce(new Error('worker failed'));
    await comp2.fetchDocsJsonForLanguage('ruby', '{}');

    // Trigger via cdd-language-change event on DOM element
    const docsEl = (fix2.nativeElement as HTMLElement).querySelector('cdd-api-docs')!;
    docsEl.dispatchEvent(new CustomEvent('cdd-language-change', { detail: { language: 'bash' } }));
    await new Promise((r) => setTimeout(r, 10));
    expect(generateCodeMock).toHaveBeenCalledWith(
      'cdd-sh',
      '{"openapi":"3.0.0","info":{"title":"T","version":"1"}}',
      'to_docs_json',
      {},
    );
  });
});
