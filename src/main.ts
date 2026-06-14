import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import * as Sentry from '@sentry/angular';

export function bootstrap(sentryDsn = 'https://placeholder-dsn@o0.ingest.sentry.io/0') {
  if (!sentryDsn.includes('placeholder-dsn')) {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      environment: 'production', // Should be injected via env variables in reality
    });
  }

  return bootstrapApplication(App, appConfig).catch((err) => console.error(err));
}

// @ts-expect-error Types for import.meta.env might not be fully configured in all environments
const isTestEnv = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test';

// Only bootstrap if we are not in a test environment
/* istanbul ignore if */
if (!isTestEnv) {
  /* istanbul ignore next */
  void bootstrap();
}