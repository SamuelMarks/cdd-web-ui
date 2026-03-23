import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import * as Sentry from '@sentry/angular';

Sentry.init({
  dsn: 'https://placeholder-dsn@o0.ingest.sentry.io/0', // Replace with real DSN in prod
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1, 
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0, 
  environment: 'production', // Should be injected via env variables in reality
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
