#!/usr/bin/env node
/**
 * @file Post-build SPA static route and 404 fallback generator for Angular builds.
 * Copies `dist/cdd-web-ui/browser/index.html` into `404.html` and static route
 * subdirectories (`workspace`, `login`, `auth-callback`, `dashboard`, and dashboard
 * child routes) so static hosts (such as GitHub Pages) serve HTTP 200 OK on direct
 * navigation or page refresh for any Angular route.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Static Angular SPA route paths that require their own `index.html` entrypoint
 * when deployed to static file servers without server-side URL rewriting.
 */
export const SPA_ROUTES = [
  'workspace',
  'login',
  'auth-callback',
  'dashboard',
  'dashboard/organizations',
  'dashboard/repositories',
  'dashboard/secrets',
  'dashboard/audit-logs',
];

/**
 * Generates `404.html` and per-route `index.html` copies inside a built browser directory.
 * @param {string} browserDir Path to the Angular build output browser directory.
 * @returns {boolean} True if `index.html` existed and routes were generated; false otherwise.
 */
export function generateSpaRouteFallbacks(browserDir) {
  const indexHtmlPath = path.join(browserDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    return false;
  }

  fs.copyFileSync(indexHtmlPath, path.join(browserDir, '404.html'));

  for (const route of SPA_ROUTES) {
    const routeDir = path.join(browserDir, route);
    fs.mkdirSync(routeDir, { recursive: true });
    fs.copyFileSync(indexHtmlPath, path.join(routeDir, 'index.html'));
  }

  return true;
}

const defaultBrowserDir = path.resolve(__dirname, '../dist/cdd-web-ui/browser');
if (generateSpaRouteFallbacks(defaultBrowserDir)) {
  console.log(
    `Generated 404.html and ${SPA_ROUTES.length} static SPA route entrypoints in ${defaultBrowserDir}`,
  );
}
