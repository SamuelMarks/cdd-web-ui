import { InjectionToken, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export const WINDOW = new InjectionToken<Window | null>('WINDOW', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return document.defaultView;
  },
});

export const GLOBAL_DATE = new InjectionToken<DateConstructor>('GLOBAL_DATE', {
  providedIn: 'root',
  factory: () => {
    const defaultView = inject(DOCUMENT).defaultView;
    return defaultView ? defaultView.Date : Date;
  },
});
