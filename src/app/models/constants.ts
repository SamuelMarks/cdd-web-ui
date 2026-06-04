/**
 * Application-wide constants.
 * @module models/constants
 */

import { LanguageConfig } from './types';

import { environment } from '../../environments/environment';

/**
 * A list of supported languages and their configuration.
 */
export const LANGUAGES: LanguageConfig[] = environment.languages;

/** Base URL for the API Docs UI iframe. */
export const DOCS_UI_BASE_URL = 'docs-ui/index.html';
