import '@angular/compiler';
import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LanguageService } from './language.service';
import { BackendConfigService } from './backend-config.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LanguageService],
    });
    service = TestBed.inject(LanguageService);
    TestBed.inject(BackendConfigService).backendUrl.set('http://test.com');
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load wasm support and update languages', async () => {
    const promise = service.loadWasmSupport();

    const req = httpMock.expectOne('/assets/wasm-support.json');
    expect(req.request.method).toBe('GET');
    req.flush({
      ts: true,
      go: true,
      python: null,
    });

    await promise;

    const langs = service.languages();
    expect(langs.find((l) => l.id === 'typescript')?.availableInWasm).toBe(true);
    expect(langs.find((l) => l.id === 'python')?.availableInWasm).toBe(false);
    expect(langs.find((l) => l.id === 'go')?.availableInWasm).toBe(true);
    expect(langs.find((l) => l.id === 'rust')?.availableInWasm).toBe(false);
  });

  it('should handle null supportMap gracefully', async () => {
    const promise = service.loadWasmSupport();

    const req = httpMock.expectOne('/assets/wasm-support.json');
    req.flush(null);

    await promise;

    const langs = service.languages();
    // Should retain defaults since supportMap was null
    expect(langs.find((l) => l.id === 'typescript')?.availableInWasm).toBe(true);
  });

  it('should gracefully handle error when loading wasm config', async () => {
    const promise = service.loadWasmSupport();

    const req = httpMock.expectOne('/assets/wasm-support.json');
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });

    await promise;

    const langs = service.languages();
    // Should retain defaults
    expect(langs.find((l) => l.id === 'typescript')?.availableInWasm).toBe(true);
    expect(langs.find((l) => l.id === 'java')?.availableInWasm).toBe(true);
  });

  it('should load wasm support and handle openapi alias', async () => {
    // Add openapi to the languages list before testing
    service.languages.set([
      ...service.languages(),
      {
        id: 'openapi',
        name: 'OpenAPI',
        repo: 'cdd-cpp',
        availableInWasm: false,
        selectedByDefault: false,
        iconUrl: '',
      },
    ]);
    const promise = service.loadWasmSupport();

    const req = httpMock.expectOne('/assets/wasm-support.json');
    req.flush({
      cpp: true,
    });

    await promise;
    expect(service.languages().find((l) => l.id === 'openapi')?.availableInWasm).toBe(true);
  });
});
