import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';
import '@angular/localize/init';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { CddWasmSdk } from 'cdd-ctl-wasm-sdk';

CddWasmSdk.fromOpenApi = async (options: any) => {
  if (options.ecosystem === 'cdd-go' || options.ecosystem === 'go') {
    return [];
  }
  if (options.specContent === 'success-spec') {
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
