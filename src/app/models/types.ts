/**
 * Core type definitions for the application.
 * @module models/types
 */

/** The available language ecosystems that can be targeted. */
export type Ecosystem = 'cdd-c' | 'cdd-cpp' | 'cdd-csharp' | 'cdd-go' | 'cdd-java' | 'cdd-kotlin' | 'cdd-php' | 'cdd-python' | 'cdd-ruby' | 'cdd-rust' | 'cdd-swift' | 'cdd-ts' | 'cdd-sh';

/** The target output format for the code generator. */
export type Target = 'to_sdk' | 'to_sdk_cli' | 'to_server' | 'to_openapi_3_2_0';

/** The supported input formats for the API specification. */
export type InputFormat = 'openapi_3_2_0' | 'openapi_older' | 'google_discovery';

/** Configuration options for the target language. */
export interface LanguageOptions {
  /** The target framework. */
  framework?: string;
  /** Whether to automatically generate admin scaffolding. */
  autoAdmin?: boolean;
  /** Whether to upgrade the OpenAPI spec automatically. */
  upgradeOpenApi?: boolean;
  /** Whether to skip generating GitHub Actions. */
  noGithubActions?: boolean;
  /** Whether to skip generating an installable package. */
  noInstallablePackage?: boolean;
  /** Additional dynamic properties. */
  [key: string]: unknown;
}

/**
 * Represents a user in the system.
 */
export interface User {
  /** The unique identifier for the user. Offline UUID, maps to GitHub user node_id/id online. */
  id: string | number;
  /** The GitHub username or login name. */
  login: string;
  /** The display name of the user. */
  name?: string;
  /** The URL to the user's profile picture. */
  avatarUrl?: string;
}

/**
 * Represents an organization that groups repositories.
 */
export interface Organization {
  /** The unique identifier for the organization. Offline UUID, maps to GitHub org node_id/id online. */
  id: string | number;
  /** The GitHub organization name or slug. */
  login: string;
  /** A brief description of the organization. */
  description?: string;
  /** The ID of the user who created or owns the organization. */
  userId: string | number;
}

/**
 * Represents a repository containing code and/or API specifications.
 */
export interface Repository {
  /** The unique identifier for the repository. Offline UUID, maps to GitHub repo node_id/id online. */
  id: string | number;
  /** The name of the repository. */
  name: string;
  /** The full name of the repository, typically in the format 'owner/repo'. */
  full_name?: string;
  /** The ID of the organization that owns this repository. */
  organizationId: string | number;
  /** A brief description of the repository. */
  description?: string;
  /** The OpenAPI specification content as a string. */
  openApiSpec?: string;
  /** The remote URL where the OpenAPI specification is hosted. */
  specUrl?: string;
}

/**
 * Configuration for a supported programming language or framework.
 */
export interface LanguageConfig {
  /** The unique identifier for the language. */
  id: string;
  /** The display name of the language. */
  name: string;
  /** The repository URL or identifier for the language generator. */
  repo: Ecosystem;
  /** Indicates whether the language generation is supported via WASM offline. */
  availableInWasm: boolean;
  /** Indicates whether this language should be selected by default in the UI. */
  selectedByDefault: boolean;
  /** The URL to the language's icon or logo. */
  iconUrl?: string;
}

/**
 * Authentication response.
 */
export interface AuthResponse {
  /** JWT token or access token */
  token: string;
}

/**
 * GitHub login payload.
 */
export interface GithubLoginPayload {
  /** OAuth code returned from GitHub */
  code: string;
}
