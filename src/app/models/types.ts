/**
 * Core type definitions for the application.
 * @module models/types
 */

/** The available language ecosystems that can be targeted. */
export type Ecosystem =
  | 'cdd-c'
  | 'cdd-cpp'
  | 'cdd-csharp'
  | 'cdd-go'
  | 'cdd-java'
  | 'cdd-kotlin'
  | 'cdd-php'
  | 'cdd-python-all'
  | 'cdd-ruby'
  | 'cdd-rust'
  | 'cdd-swift'
  | 'cdd-ts'
  | 'cdd-sh';

/** The target output format for the code generator. */
export type Target =
  'to_sdk' | 'to_sdk_cli' | 'to_server' | 'to_openapi_3_2_0' | 'to_orm' | 'to_mcp';

/** The supported input formats for the API specification. */
export type InputFormat = 'openapi_3_2_0' | 'openapi_older' | 'google_discovery' | 'c_source';

/** The active input mode tab in the OpenAPI specification pane. */
export type OpenApiInputMode = 'editor' | 'urls';

/** The fetch lifecycle status for an individual remote OpenAPI URL entry. */
export type OpenApiUrlStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Represents a single remote OpenAPI specification URL entry in the URLs tab.
 */
export interface OpenApiUrlEntry {
  /** Unique identifier for tracking the entry in templates and state updates. */
  id: string;
  /** The remote HTTP/HTTPS URL pointing to the OpenAPI specification. */
  url: string;
  /** Current fetch lifecycle status for this URL. */
  status: OpenApiUrlStatus;
  /** Fetched raw specification content (JSON or YAML) if loaded. */
  content?: string;
  /** Error message if fetching or validation failed, or null if none. */
  error?: string | null;
  /** Epoch timestamp (milliseconds) when the URL was last successfully fetched. */
  lastFetched?: number;
}

/** The execution mode for WASM or Native runtimes. */
export type RunMode =
  'local_relative' | 'local_cdd_ctl_wasm' | 'local_cdd_ctl_native' | 'served_github';

/** Connection status for the remote backend server. */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Optional per-service endpoint URL overrides for non-gateway or split deployments.
 */
export interface ServiceEndpointOverrides {
  /** Optional direct URL override for the Control Plane API (`cdd-control-plane`). */
  controlPlaneUrl?: string | null;
  /** Optional direct URL override for the Artifact Storage service (`cdd-storage`). */
  storageUrl?: string | null;
  /** Optional direct URL override for the API Documentation UI (`cdd-docs-ui`). */
  docsUiUrl?: string | null;
}

/**
 * Health check response returned by `cdd-gateway` and `cdd-control-plane`.
 */
export interface HealthResponse {
  /** Health status string (typically `'ok'`). */
  status: string;
}

/**
 * Version information response returned by `GET /version` or JSON-RPC `version`.
 */
export interface VersionResponse {
  /** Legacy or direct API version string. */
  version?: string;
  /** Gateway version string (`cdd-gateway`). */
  gateway?: string;
  /** Map of ecosystem identifiers to their detected compiler versions. */
  ecosystem?: Record<string, string>;
}

/**
 * Decoded JWT payload claims issued by `cdd-gateway` or `cdd-control-plane`.
 */
export interface JwtClaims {
  /** Numeric user ID subject claim. */
  sub: number;
  /** Expiration timestamp in seconds since Unix epoch. */
  exp: number;
  /** Account login username. */
  username: string;
}

/** Role of a user within an organization. */
export type OrgRole = 'owner' | 'admin' | 'member';

/** Configuration options for the target language. */
export interface LanguageOptions {
  /** The target framework. */
  framework?: string;
  /** The target server framework. */
  serverFramework?: string;
  /** The target ORM. */
  orm?: string;
  /** Whether to automatically generate admin scaffolding. */
  autoAdmin?: boolean;
  /** Whether to omit imports in docs json target. */
  noImports?: boolean;
  /** Whether to omit wrapping blocks in docs json target. */
  noWrapping?: boolean;

  /** Whether to upgrade the OpenAPI spec automatically. */
  upgradeOpenApi?: boolean;
  /** Whether to skip generating GitHub Actions. */
  noGithubActions?: boolean;
  /** Whether to skip generating an installable package. */
  noInstallablePackage?: boolean;
  /** Whether to create composable tests & mocks. */
  tests?: boolean;
  /** Whether to generate Model Context Protocol (MCP) server. */
  mcp?: boolean;
  /** Whether to generate using an ephemeral database (sandbox mode). */
  withEphemeral?: boolean;
  /** Whether to seed the database with mock data. */
  withSeed?: boolean;
  /** Whether to skip generating services. */
  noGenerateServices?: boolean;
  /** Whether to disable all test generation. */
  noTestGen?: boolean;
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
  /** Optional human-readable display name. */
  name?: string;
  /** A brief description of the organization. */
  description?: string | null;
  /** The ID of the user who created or owns the organization. */
  userId?: string | number;
  /** Optional GitHub organization ID from `cdd-control-plane`. */
  github_id?: number | null;
  /** Optional role of the current user in the organization. */
  role?: OrgRole | 'Owner' | 'Admin' | 'Member';
  /** Optional member count in the organization. */
  members?: number;
}

/**
 * Payload for creating an organization via `POST /orgs` or `POST /api/v1/orgs`.
 */
export interface CreateOrgPayload {
  /** Unique organization login handle (`1..=64` alphanumeric, `-`, `_`). */
  login: string;
  /** Optional human-readable description of the organization. */
  description?: string;
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
  /** The ID of the organization that owns this repository (camelCase alias). */
  organizationId?: string | number;
  /** The numeric ID of the organization that owns this repository (`cdd-control-plane`). */
  organization_id?: number;
  /** Display name or login of the owning organization. */
  organization?: string;
  /** Optional GitHub repository ID from `cdd-control-plane`. */
  github_id?: number | null;
  /** A brief description of the repository. */
  description?: string | null;
  /** The OpenAPI specification content as a string. */
  openApiSpec?: string;
  /** The remote URL where the OpenAPI specification is hosted. */
  specUrl?: string;
  /** Alias for the remote OpenAPI schema URL used in the dashboard. */
  schemaUrl?: string;
  /** Target SDK languages configured for this repository. */
  languages?: string[];
}

/**
 * Payload for creating a repository via `POST /api/v1/orgs/{org_id}/repos` or `POST /repos`.
 */
export interface CreateRepoPayload {
  /** Repository name (`1..=64` alphanumeric, `-`, `_`). */
  name: string;
  /** Optional repository description. */
  description?: string;
  /** Optional owning organization ID (required by `POST /repos` on gateway). */
  organization_id?: number;
}

/**
 * Represents a tagged SDK release record in `cdd-control-plane`.
 */
export interface Release {
  /** Primary key ID of the release. */
  id: number;
  /** Foreign key ID of the parent repository. */
  repository_id: number;
  /** Optional GitHub release ID. */
  github_id?: number | null;
  /** Git tag name for the release (e.g., `'v1.0.0'`). */
  tag_name: string;
  /** Optional human-readable release title. */
  name?: string | null;
  /** Optional markdown release notes body. */
  body?: string | null;
}

/**
 * Payload for creating a release via `POST /api/v1/orgs/{org_id}/repos/{repo_id}/releases`.
 */
export interface CreateReleasePayload {
  /** Git tag name for the release (e.g., `'v1.0.0'`). */
  tag_name: string;
  /** Optional release title. */
  name?: string;
  /** Optional release notes body. */
  body?: string;
}

/** Supported third-party registry and VCS token providers in `cdd-control-plane` and `cdd-publisher`. */
export type TokenProvider = 'github' | 'npm' | 'pypi' | 'cargo';

/**
 * Payload for storing an encrypted token in the Control Plane vault (`POST /api/v1/tokens`).
 */
export interface StoreTokenPayload {
  /** Target registry or VCS provider. */
  provider: TokenProvider;
  /** Plaintext secret token to encrypt and store. */
  token: string;
}

/**
 * Response from `POST /github/sync` on `cdd-gateway`.
 */
export interface SyncStatus {
  /** Whether synchronization completed without fatal errors. */
  success: boolean;
  /** Human-readable summary message describing the synchronization outcome. */
  message: string;
}

/**
 * Payload for dispatching a GitHub Actions workflow run (`POST /github/actions/workflows/trigger`).
 */
export interface TriggerWorkflowPayload {
  /** Repository owner or organization login. */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Workflow filename (e.g., `'ci.yml'`) or workflow ID. */
  workflow_id: string;
  /** Git branch or tag reference to run the workflow on. */
  ref_branch: string;
}

/**
 * Payload for creating or updating a repository GitHub Actions secret (`POST /github/actions/secrets`).
 */
export interface CreateGithubSecretPayload {
  /** Repository owner or organization login. */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Name of the GitHub Actions secret. */
  secret_name: string;
  /** Secret value to upload. */
  secret_value: string;
}

/**
 * Payload for creating a GitHub release via `POST /github/releases` on `cdd-gateway`.
 */
export interface GithubReleasePayload {
  /** Repository owner or organization login. */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Git tag name for the release. */
  tag_name: string;
  /** Optional release title. */
  name?: string;
  /** Optional release notes body. */
  body?: string;
}

/** Supported audit action identifiers emitted by `cdd-control-plane` and `cdd-publisher`. */
export type AuditActionType =
  | 'org_created'
  | 'member_added'
  | 'repo_created'
  | 'release_created'
  | 'token_stored'
  | 'token_deleted'
  | 'sdk_generated'
  | 'sdk_published'
  | 'publish_failed';

/**
 * Response from `POST /github/webhook` on `cdd-gateway`.
 */
export interface WebhookResponse {
  /** Whether the GitHub webhook signature was verified and processed. */
  success: boolean;
}

/**
 * Payload for inviting a member to an organization via `POST /api/v1/orgs/{id}/members`.
 */
export interface InviteMemberPayload {
  /** Email address of the invited user. */
  email: string;
  /** Role to assign to the member within the organization. */
  role: OrgRole;
}

/** Supported target package registries in `cdd-publisher`. */
export type PublisherRegistry = 'npm' | 'pypi' | 'cargo';

/**
 * Audit telemetry payload reported by `cdd-publisher` to `POST /api/v1/audit/publish`.
 */
export interface PublishAuditPayload {
  /** Identifier of the published artifact. */
  artifact_id: string;
  /** Target package registry (`'npm'`, `'pypi'`, or `'cargo'`). */
  registry: PublisherRegistry;
  /** Whether the package publish succeeded. */
  success: boolean;
  /** Optional error trace if publishing failed. */
  error_message?: string | null;
}

/**
 * Strongly typed arguments for the `cdd_generate_sdk` MCP tool exposed by `cdd-engine`.
 */
export interface McpGenerateSdkArguments {
  /** Target ecosystem language slug or `cdd-*` daemon identifier. */
  target_language: string;
  /** Optional OpenAPI specification content or path. */
  input?: string;
  /** Optional output directory path. */
  output?: string;
}

/**
 * Audit log record returned by `GET /api/v1/orgs/{org_id}/audit`.
 */
export interface AuditLogRecord {
  /** Primary key ID of the audit event. */
  id: number;
  /** Organization ID associated with the event. */
  org_id: number;
  /** Optional repository ID associated with the event. */
  repo_id: number | null;
  /** User ID who triggered the action. */
  user_id: number;
  /** Action identifier string. */
  action: AuditActionType;
  /** Optional structured JSON metadata attached to the event. */
  metadata_json: Record<string, unknown> | null;
  /** ISO-8601 timestamp when the event was recorded. */
  timestamp: string;
}

/**
 * Pagination query parameters for `GET /api/v1/orgs/{org_id}/audit`.
 */
export interface AuditLogQuery {
  /** Maximum number of records to return (`1..=100`). */
  limit?: number;
  /** Number of records to skip (`>= 0`). */
  offset?: number;
}

/**
 * Generic JSON-RPC 2.0 request envelope.
 */
export interface JsonRpcRequest<T = Record<string, unknown>> {
  /** JSON-RPC protocol version (`'2.0'`). */
  jsonrpc: '2.0';
  /** Correlation identifier for the request. */
  id: number | string;
  /** Target RPC method name. */
  method: string;
  /** Optional structured method parameters. */
  params?: T;
}

/**
 * JSON-RPC 2.0 error object.
 */
export interface JsonRpcError {
  /** Numeric JSON-RPC error code. */
  code: number;
  /** Human-readable error description. */
  message: string;
  /** Optional additional error data. */
  data?: unknown;
}

/**
 * Generic JSON-RPC 2.0 response envelope.
 */
export interface JsonRpcResponse<R = unknown> {
  /** JSON-RPC protocol version (`'2.0'`). */
  jsonrpc: '2.0';
  /** Correlation identifier matching the request. */
  id: number | string | null;
  /** Successful result payload if no error occurred. */
  result?: R;
  /** Error payload if the RPC call failed. */
  error?: JsonRpcError;
}

/**
 * JSON Schema definition for an MCP tool's input parameters.
 */
export interface McpToolInputSchema {
  /** Schema root type (typically `'object'`). */
  type: string;
  /** Map of parameter names to JSON schema definitions. */
  properties?: Record<string, unknown>;
  /** List of required parameter names. */
  required?: string[];
}

/**
 * Descriptor for an MCP tool exposed by `cdd-engine`.
 */
export interface McpTool {
  /** Unique tool name (e.g., `'cdd-rust'`, `'to_sdk'`). */
  name: string;
  /** Human-readable description of the tool. */
  description?: string;
  /** JSON Schema for the tool input arguments. */
  inputSchema?: McpToolInputSchema;
}

/**
 * Result payload returned by MCP `initialize`.
 */
export interface McpInitializeResult {
  /** Negotiated MCP protocol version. */
  protocolVersion: string;
  /** Server capability map. */
  capabilities: Record<string, unknown>;
  /** Server implementation metadata. */
  serverInfo: {
    /** Server name. */
    name: string;
    /** Server version. */
    version: string;
  };
}

/**
 * Result payload returned by MCP `tools/list`.
 */
export interface McpListToolsResult {
  /** Available MCP tools registered with the orchestrator. */
  tools: McpTool[];
}

/**
 * Content item returned inside an MCP `tools/call` response.
 */
export interface McpContentItem {
  /** Content item type (e.g., `'text'`). */
  type: string;
  /** Text content returned by the tool execution. */
  text: string;
}

/**
 * Result payload returned by MCP `tools/call`.
 */
export interface McpCallToolResult {
  /** Output content blocks produced by the tool. */
  content: McpContentItem[];
  /** Whether the tool execution resulted in an error. */
  isError?: boolean;
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
