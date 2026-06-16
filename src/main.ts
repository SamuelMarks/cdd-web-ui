import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import * as Sentry from '@sentry/angular';

/**
 * Bootstraps the Angular application and initializes Sentry for error tracking.
 * @param sentryDsn The Sentry Data Source Name. Defaults to a placeholder.
 * @returns A promise that resolves when the application is bootstrapped.
 */
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

// Bootstrap the application
void bootstrap();
