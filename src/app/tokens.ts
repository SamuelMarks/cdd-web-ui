import { InjectionToken, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * Injection token for the global Window object.
 * Returns null if not in a browser environment.
 */
export const WINDOW = new InjectionToken<Window | null>('WINDOW', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return document.defaultView;
  },
});

/**
 * Injection token for the global Date constructor.
 * Ensures the correct Date object is used depending on the environment.
 */
export const GLOBAL_DATE = new InjectionToken<DateConstructor>('GLOBAL_DATE', {
  providedIn: 'root',
  factory: () => {
    const defaultView = inject(DOCUMENT).defaultView;
    return defaultView ? defaultView.Date : Date;
  },
});
