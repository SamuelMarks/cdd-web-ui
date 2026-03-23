import { appConfig, initWasmSupport } from './app.config';
import { LanguageService } from './services/language.service';

describe('AppConfig', () => {
  it('should create appConfig', () => {
    expect(appConfig).toBeTruthy();
    expect(appConfig.providers).toBeDefined();
  });

  it('should initialize wasm support', () => {
    const mockLanguageService = {
      loadWasmSupport: vi.fn(),
    } as unknown as LanguageService;
    
    const initFn = initWasmSupport(mockLanguageService);
    initFn();
    
    expect(mockLanguageService.loadWasmSupport).toHaveBeenCalled();
  });
});
