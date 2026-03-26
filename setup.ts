import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';
import '@angular/localize/init';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { CddWasmSdk, GenerateOptions } from 'cdd-ctl-wasm-sdk';

CddWasmSdk.fromOpenApi = async (options: GenerateOptions) => {
  const ecosystem = options.ecosystem as string;
  const specContent = options.specContent as string;
  if (ecosystem === 'cdd-go' || ecosystem === 'go') {
    return [];
  }
  if (specContent === 'success-spec') {
    return [
      {
        path: 'success.py',
        content: new TextEncoder().encode('Generated content for success'),
      },
    ];
  }
  throw new Error('WASM error');
};

try {
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch (e) {}
global.ResizeObserver = class ResizeObserver { observe() {} unobserve() {} disconnect() {} };

if (typeof window !== 'undefined' && window.SVGElement) {
  Object.defineProperty(window.SVGElement.prototype, 'transform', {
    get() { return { baseVal: { consolidate: () => null } }; }
  });
}
