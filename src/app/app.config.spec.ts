import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig, initWasmSupport } from './app.config';
import { LanguageService } from './services/language.service';

describe('AppConfig', () => {
  it('should create appConfig and run app initializer', async () => {
    expect(appConfig).toBeTruthy();
    expect(appConfig.providers).toBeDefined();

    const mockLanguageService = {
      loadWasmSupport: vi.fn().mockResolvedValue(undefined),
    } as unknown as LanguageService;

    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        { provide: LanguageService, useValue: mockLanguageService },
      ],
    });

    const initStatus = TestBed.inject(ApplicationInitStatus);
    await initStatus.donePromise;
    expect(mockLanguageService.loadWasmSupport).toHaveBeenCalled();
  });

  it('should initialize wasm support', async () => {
    const mockLanguageService = {
      loadWasmSupport: vi.fn(),
    } as unknown as LanguageService;

    const initFn = initWasmSupport(mockLanguageService);
    await initFn();

    expect(mockLanguageService.loadWasmSupport).toHaveBeenCalled();
  });
});
