import { TestBed } from '@angular/core/testing';
import { WINDOW, GLOBAL_DATE } from './tokens';
import { DOCUMENT } from '@angular/common';

describe('Tokens', () => {
  it('should provide WINDOW', () => {
    const windowToken = TestBed.inject(WINDOW);
    expect(windowToken).toBe(window);
  });

  it('should provide GLOBAL_DATE', () => {
    const dateToken = TestBed.inject(GLOBAL_DATE);
    expect(dateToken).toBe(Date);
  });

  it('should fallback Date when defaultView is null', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: null } }],
    });
    const dateToken = TestBed.inject(GLOBAL_DATE);
    expect(dateToken).toBe(Date);
  });
});
