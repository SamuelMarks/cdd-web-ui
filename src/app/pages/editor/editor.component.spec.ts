import '@angular/compiler';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorComponent } from './editor.component';
import { StorageService } from '../../services/storage.service';
import { WasmGeneratorService } from '../../services/wasm-generator.service';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

describe('EditorComponent', () => {
  let component: EditorComponent;
  let fixture: ComponentFixture<EditorComponent>;
  let storage: StorageService;
  let wasm: WasmGeneratorService;

  const mockRoute = {
    paramMap: of(new Map([['id', 'proj-1']])),
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EditorComponent, MonacoEditorModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: mockRoute },
        StorageService,
        WasmGeneratorService,
      ],
    }).compileComponents();

    storage = TestBed.inject(StorageService);
    wasm = TestBed.inject(WasmGeneratorService);

    storage.createUser('Alice');
    const org = storage.createOrganization('Test Prog');
    const proj = storage.createRepository(org.id, 'Test Repository');
    storage.repositories.set([
      { ...proj, id: 'proj-1', openApiSpec: 'test-spec', specUrl: 'https://example.com/spec.yml' },
    ]);

    fixture = TestBed.createComponent(EditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load examples correctly', () => {
    component.loadExample('helloworld');
    expect(component.openapiSpec()).toContain('Hello World API');

    component.loadExample('empty');
    expect(component.openapiSpec()).toBe('');

    component.loadExample('petstore');
    expect(component.openapiSpec()).toContain('Swagger Petstore');
  });

  it('should handle fetch errors gracefully', async () => {
    // Override window.fetch to throw
    const originalFetch = window.fetch;
    window.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));
    component.specUrl.set('http://invalid');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await component.fetchRemoteSpec();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to fetch spec',
      expect.objectContaining({ name: 'Error' }),
    );

    // Restore
    window.fetch = originalFetch;
    consoleSpy.mockRestore();
  });

  it('should load repository details', () => {
    expect(component.repository()?.name).toBe('Test Repository');
    expect(component.openapiSpec()).toBe('test-spec');
    expect(component.specSourceType()).toBe('url');
    expect(component.specUrl()).toBe('https://example.com/spec.yml');
  });

  it('should toggle language selection', () => {
    const wasmSupportedLang = 'typescript'; // Default available and selected
    expect(component.selectedLanguages().has(wasmSupportedLang)).toBe(true);

    component.toggleLanguage(wasmSupportedLang);
    expect(component.selectedLanguages().has(wasmSupportedLang)).toBe(false);

    component.toggleLanguage(wasmSupportedLang);
    expect(component.selectedLanguages().has(wasmSupportedLang)).toBe(true);
  });

  it('should not toggle unsupported language', () => {
    const unsupportedLang = 'java';
    expect(component.selectedLanguages().has(unsupportedLang)).toBe(false);

    component.toggleLanguage(unsupportedLang);
    expect(component.selectedLanguages().has(unsupportedLang)).toBe(false);
  });

  it('should toggle swap view', () => {
    expect(component.openapiLeft()).toBe(true);
    component.toggleSwap();
    expect(component.openapiLeft()).toBe(false);
  });

  it('should run OpenAPI to SDK and CI/CD generation', async () => {
    vi.spyOn(wasm, 'generateSdk').mockReturnValue(Promise.resolve('generated_python_code'));
    vi.spyOn(wasm, 'generateCiCd').mockReturnValue(Promise.resolve('generated_ci_code'));

    component.openapiSpec.set('some spec');
    component.openapiLeft.set(true);

    await component.onRun();

    expect(wasm.generateSdk).toHaveBeenCalled();
    expect(wasm.generateCiCd).toHaveBeenCalled();

    component.activeOutputType.set('sdk');
    expect(component.getCurrentOutputCode()).toBe('generated_python_code');

    component.activeOutputType.set('ci');
    expect(component.getCurrentOutputCode()).toBe('generated_ci_code');

    expect(storage.repositories()[0].openApiSpec).toBe('some spec');
  });

  it('should run SDK to OpenAPI generation', async () => {
    vi.spyOn(wasm, 'generateOpenApi').mockReturnValue(Promise.resolve('generated_spec'));

    // Select python
    component.activeSdkTab.set('python');
    component.activeOutputType.set('sdk');
    component.setCurrentOutputCode('python code');
    component.openapiLeft.set(false);

    await component.onRun();

    expect(wasm.generateOpenApi).toHaveBeenCalledWith(expect.anything(), 'python', 'python code');
    expect(component.openapiSpec()).toBe('generated_spec');
    expect(storage.repositories()[0].openApiSpec).toBe('generated_spec');
  });

  it('should set current SDK code', () => {
    component.activeSdkTab.set('typescript');
    component.activeOutputType.set('sdk');
    component.setCurrentOutputCode('let x = 1;');
    expect(component.getCurrentOutputCode()).toBe('let x = 1;');
  });

  it('should fetch remote spec', async () => {
    const originalFetch = window.fetch;
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'Remote API',
    });

    component.specUrl.set('http://remote');
    await component.fetchRemoteSpec();
    expect(component.openapiSpec()).toContain('Remote API');

    window.fetch = originalFetch;
  });

  it('should do nothing on fetch with empty URL', async () => {
    component.specUrl.set('');
    component.openapiSpec.set('old spec');
    await component.fetchRemoteSpec();
    expect(component.openapiSpec()).toBe('old spec');
  });

  it('should default SDK tab if none active', () => {
    component.activeSdkTab.set(null);
    TestBed.flushEffects();
    // After effect runs, it should select the first available language
    expect(component.activeSdkTab()).toBeTruthy();
  });

  it('should return correct monaco language ID', () => {
    expect(component['getMonacoLanguageId']('python')).toBe('python');
    expect(component['getMonacoLanguageId']('rust')).toBe('rust');
    expect(component['getMonacoLanguageId']('go')).toBe('go');
    expect(component['getMonacoLanguageId']('java')).toBe('java');
    expect(component['getMonacoLanguageId']('ruby')).toBe('plaintext');
    expect(component['getMonacoLanguageId'](null)).toBe('plaintext');
  });
});
