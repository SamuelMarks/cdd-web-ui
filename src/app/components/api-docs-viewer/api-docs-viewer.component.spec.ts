import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiDocsViewerComponent, isExcludedSdkProjectFile } from './api-docs-viewer.component';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { AppState } from '../../store/state';
import {
  selectOpenApiSpecContent,
  selectGeneratedFiles,
  selectDocsJsonExamples,
  selectDocsJsonLanguageId,
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
            { selector: selectDocsJsonExamples, value: [] },
            { selector: selectDocsJsonLanguageId, value: undefined },
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
    store.resetSelectors();
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

  it('should map sdk examples correctly dynamically based on language when docs.json is present', () => {
    store.overrideSelector(selectSelectedLanguageId, 'cdd-ruby');
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new Uint8Array([116, 101, 115, 116]) },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()).toEqual([
      { language: 'ruby', filepath: 'docs.json', content: 'test' },
    ]);
  });

  it('should fallback to typescript if !langId', () => {
    store.overrideSelector(selectSelectedLanguageId, '');
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new Uint8Array([116, 101, 115, 116]) },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()).toEqual([
      { language: 'typescript', filepath: 'docs.json', content: 'test' },
    ]);
  });

  it('should normalize cdd-python-all to python', () => {
    store.overrideSelector(selectSelectedLanguageId, 'cdd-python-all');
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new Uint8Array([116, 101, 115, 116]) },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()).toEqual([
      { language: 'python', filepath: 'docs.json', content: 'test' },
    ]);
  });

  it('should normalize cdd-sh to bash', () => {
    store.overrideSelector(selectSelectedLanguageId, 'cdd-sh');
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new Uint8Array([116, 101, 115, 116]) },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()).toEqual([
      { language: 'bash', filepath: 'docs.json', content: 'test' },
    ]);
  });

  it('should prefer docs.json snippets from to_docs_json over raw to_sdk project files', () => {
    store.overrideSelector(selectSelectedLanguageId, 'rust');
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'Cargo.toml', content: new TextEncoder().encode('[package]') },
      { path: 'src/lib.rs', content: new TextEncoder().encode('pub struct Client;') },
      {
        path: 'out/docs.json',
        content: new TextEncoder().encode('{"endpoints":{"/pets":{"get":"Client::get_pets()"}}}'),
      },
    ]);
    store.refreshState();

    const examples = component.mappedSdkExamples();
    expect(examples).toEqual([
      {
        language: 'rust',
        filepath: 'docs.json',
        content: '{"endpoints":{"/pets":{"get":"Client::get_pets()"}}}',
      },
    ]);

    // Also test when selectDocsJsonExamples provides dedicated docs.json files
    store.overrideSelector(selectDocsJsonExamples, [
      {
        path: 'docs.json',
        content: new TextEncoder().encode('{"endpoints":{"/pets":{"post":"Client::create()"}}}'),
      },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples()).toEqual([
      {
        language: 'rust',
        filepath: 'docs.json',
        content: '{"endpoints":{"/pets":{"post":"Client::create()"}}}',
      },
    ]);
  });

  it('should not fall back to raw to_sdk source files when docs.json is empty', () => {
    expect(isExcludedSdkProjectFile('')).toBe(false);
    expect(isExcludedSdkProjectFile('Cargo.toml')).toBe(true);
    expect(isExcludedSdkProjectFile('package.json')).toBe(true);
    expect(isExcludedSdkProjectFile('CMakeLists.txt')).toBe(true);
    expect(isExcludedSdkProjectFile('pom.xml')).toBe(true);
    expect(isExcludedSdkProjectFile('build.gradle.kts')).toBe(true);
    expect(isExcludedSdkProjectFile('README.md')).toBe(true);
    expect(isExcludedSdkProjectFile('.github/workflows/ci.yml')).toBe(true);
    expect(isExcludedSdkProjectFile('tests/client_test.rs')).toBe(true);
    expect(isExcludedSdkProjectFile('src/client.rs')).toBe(false);

    store.overrideSelector(selectDocsJsonExamples, []);
    store.overrideSelector(selectSelectedLanguageId, 'rust');
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'Cargo.toml', content: new TextEncoder().encode('[package]') },
      { path: 'package.json', content: new TextEncoder().encode('{}') },
      { path: 'CMakeLists.txt', content: new TextEncoder().encode('project(sdk)') },
      { path: 'pom.xml', content: new TextEncoder().encode('<project/>') },
      { path: 'build.gradle.kts', content: new TextEncoder().encode('plugins {}') },
      { path: 'README.md', content: new TextEncoder().encode('# SDK') },
      { path: '.github/workflows/ci.yml', content: new TextEncoder().encode('name: CI') },
      { path: 'tests/api_test.rs', content: new TextEncoder().encode('#[test]') },
      { path: 'src/client.rs', content: new TextEncoder().encode('pub fn get_pet() {}') },
    ]);
    store.refreshState();

    expect(component.mappedSdkExamples()).toEqual([]);
  });

  it('should bind [attr.active-language] and refresh mappedSdkExamples when switching from C to C++', () => {
    const docsEl = (fixture.nativeElement as HTMLElement).querySelector('cdd-api-docs')!;

    // 1. Select C with C docs.json
    store.overrideSelector(selectSelectedLanguageId, 'c');
    store.overrideSelector(selectDocsJsonLanguageId, 'c');
    store.overrideSelector(selectDocsJsonExamples, [
      {
        path: 'docs.json',
        content: new TextEncoder().encode('{"endpoints":{"/pets":{"get":"pet_list();"}}}'),
      },
    ]);
    store.refreshState();
    fixture.detectChanges();

    expect(docsEl.getAttribute('active-language')).toBe('c');
    expect(component.mappedSdkExamples()[0]).toEqual({
      language: 'c',
      filepath: 'docs.json',
      content: '{"endpoints":{"/pets":{"get":"pet_list();"}}}',
    });

    // 2. Switch to C++ while stale C docs.json is still tagged with 'c' or contains language: 'c'
    store.overrideSelector(selectSelectedLanguageId, 'cpp');
    store.refreshState();
    fixture.detectChanges();

    expect(docsEl.getAttribute('active-language')).toBe('cpp');

    // Also test JSON payload with explicit mismatched language property
    store.overrideSelector(selectDocsJsonLanguageId, undefined);
    store.overrideSelector(selectDocsJsonExamples, [
      {
        path: 'docs.json',
        content: new TextEncoder().encode('[{"language":"c","operations":[]}]'),
      },
    ]);
    store.refreshState();
    expect(component.mappedSdkExamples().some((e) => e.language === 'cpp')).toBe(false);

    // 3. C++ docs.json arrives -> cpp is ordered first and active-language is 'cpp'
    store.overrideSelector(selectDocsJsonLanguageId, 'cpp');
    store.overrideSelector(selectDocsJsonExamples, [
      {
        path: 'docs.json',
        content: new TextEncoder().encode(
          '[{"language":"cpp","operations":[{"operationId":"listPets","code":{"snippet":"client.list_pets();"}}]}]',
        ),
      },
    ]);
    store.refreshState();
    fixture.detectChanges();

    expect(docsEl.getAttribute('active-language')).toBe('cpp');
    expect(component.mappedSdkExamples()[0].language).toBe('cpp');
    expect(component.mappedSdkExamples()[0].content).toContain('client.list_pets();');

    // 4. Switch back to C with empty store docs -> instant hit from docsJsonCache ordered first
    store.overrideSelector(selectSelectedLanguageId, 'c');
    store.overrideSelector(selectDocsJsonLanguageId, undefined);
    store.overrideSelector(selectDocsJsonExamples, []);
    store.refreshState();
    fixture.detectChanges();

    expect(docsEl.getAttribute('active-language')).toBe('c');
    expect(component.mappedSdkExamples()[0].language).toBe('c');
    expect(component.mappedSdkExamples()[0].content).toContain('pet_list();');
  });

  it('should map all 13 language IDs consistently between cdd-web-ui and cdd-docs-ui', () => {
    const expectedMappings: Array<[string, string]> = [
      ['c', 'c'],
      ['cpp', 'cpp'],
      ['csharp', 'csharp'],
      ['go', 'go'],
      ['java', 'java'],
      ['kotlin', 'kotlin'],
      ['php', 'php'],
      ['python', 'python'],
      ['ruby', 'ruby'],
      ['rust', 'rust'],
      ['sh', 'bash'],
      ['swift', 'swift'],
      ['typescript', 'typescript'],
      ['cdd-ts', 'typescript'],
      ['custom-lang', 'custom-lang'],
    ];

    store.overrideSelector(selectDocsJsonExamples, []);
    store.overrideSelector(selectGeneratedFiles, [
      { path: 'docs.json', content: new TextEncoder().encode('{"endpoints":{}}') },
    ]);

    for (const [inputLang, expectedUiLang] of expectedMappings) {
      store.overrideSelector(selectSelectedLanguageId, inputLang);
      store.refreshState();
      expect(component.mappedSdkExamples()[0].language).toBe(expectedUiLang);
    }
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
