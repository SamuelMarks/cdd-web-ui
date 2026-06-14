import { describe, it, expect } from 'vitest';
import { environment } from './environment.c-only';

describe('Environment C-Only', () => {
  it('should be correctly configured for single language mode', () => {
    expect(environment.singleLanguageMode).toBe(true);
    expect(environment.eagerLoadWasm).toBe(true);
    expect(environment.appName).toBe('rewriteInC WASM frontend');
    expect(environment.languages.length).toBe(1);
    expect(environment.languages[0].id).toBe('c');
  });
});
