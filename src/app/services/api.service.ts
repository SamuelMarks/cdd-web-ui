/**
 * HTTP API service for communicating with the CDD backend control plane and gateway.
 * @module app/services/api.service
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BackendConfigService } from './backend-config.service';
import {
  AuditLogQuery,
  AuditLogRecord,
  CreateGithubSecretPayload,
  CreateOrgPayload,
  CreateReleasePayload,
  CreateRepoPayload,
  GithubReleasePayload,
  HealthResponse,
  InviteMemberPayload,
  Organization,
  PublishAuditPayload,
  Release,
  Repository,
  StoreTokenPayload,
  SyncStatus,
  TokenProvider,
  TriggerWorkflowPayload,
  VersionResponse,
  WebhookResponse,
} from '../models/types';

/** Payload for user registration. */
export interface RegisterPayload {
  /** The desired username. */
  username: string;
  /** The user's email. */
  email: string;
  /** The optional password. */
  password?: string;
}

/** Payload for user login. */
export interface LoginPayload {
  /** The username to login with. */
  username: string;
  /** The user's password. */
  password?: string;
}

/** Response from auth endpoints. */
export interface AuthResponse {
  /** The authentication token. */
  token: string;
}

/** Payload for GitHub OAuth. */
export interface OAuthPayload {
  /** The OAuth code from GitHub. */
  code: string;
}

/** Payload for Organization creation. */
export type OrgPayload = CreateOrgPayload;

/** Payload for Repository creation. */
export interface RepoPayload {
  /** The organization ID that will own the repo. */
  organization_id: number;
  /** The name of the repository. */
  name: string;
  /** An optional description for the repository. */
  description?: string;
}

/** Re-export VersionResponse for backward compatibility. */
export type { VersionResponse };

/** Payload for GitHub trigger. */
export interface TriggerPayload {
  /** The branch, tag, or commit SHA to trigger. */
  ref: string;
  /** Optional workflow inputs. */
  inputs?: Record<string, string>;
}

/** Payload for creating a release. */
export interface ReleasePayload {
  /** The internal repository ID. */
  repository_id: number;
  /** The tag name for the release. */
  tag_name: string;
  /** The release name. */
  name?: string;
  /** The release description/body. */
  body?: string;
}

/** Payload for GitHub secret. */
export interface SecretPayload {
  /** The internal repository ID. */
  repository_id: number;
  /** The name of the secret to set. */
  secret_name: string;
  /** The value of the secret. */
  secret_value: string;
}

/**
 * Service to handle communication with the CDD backend API (`cdd-gateway` and `cdd-control-plane`).
 */
@Injectable({
  providedIn: 'root',
})
/** ApiService */
export class ApiService {
  /** The HTTP client instance. */
  private readonly http = inject(HttpClient);
  /** The backend configuration service instance. */
  private readonly config = inject(BackendConfigService);

  /**
   * Helper to construct the full URL against the configured backend base URL.
   * @param path API endpoint path starting with `/`.
   * @param baseUrlOverride Optional base URL override for probing before saving.
   * @returns Full URL string.
   */
  private url(path: string, baseUrlOverride?: string): string {
    const baseUrl = baseUrlOverride ?? this.config.backendUrl();
    if (!baseUrl) {
      throw new Error('Offline mode active. Cannot call API.');
    }
    return `${baseUrl.replace(/\/+$/, '')}${path}`;
  }

  /**
   * Helper to construct the full URL against the Control Plane `/api/v1` base URL.
   * @param path API endpoint path relative to `/api/v1` (starting with `/`).
   * @returns Full Control Plane URL string.
   */
  private controlPlaneUrl(path: string): string {
    const cpUrl = this.config.controlPlaneUrl();
    if (!cpUrl) {
      throw new Error('Offline mode active. Cannot call API.');
    }
    return `${cpUrl.replace(/\/+$/, '')}${path}`;
  }

  /**
   * Helper to build optional Authorization Bearer headers when an explicit token is supplied.
   * @param token Optional JWT bearer token.
   * @returns Object containing `headers` if `token` is provided, or empty options object.
   */
  private headers(token?: string): {
    /** Optional HTTP request headers containing the Authorization Bearer token. */
    headers?: HttpHeaders;
  } {
    if (!token) {
      return {};
    }
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  /**
   * Checks health of the API Gateway (`GET /health`).
   * @param baseUrl Optional base URL override to probe.
   * @returns Observable emitting the gateway health response.
   */
  checkGatewayHealth(baseUrl?: string): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(this.url('/health', baseUrl));
  }

  /**
   * Checks health of the Control Plane (`GET /api/v1/health`).
   * @param baseUrl Optional base URL override to probe.
   * @returns Observable emitting the control plane health response.
   */
  checkControlPlaneHealth(baseUrl?: string): Observable<HealthResponse> {
    if (baseUrl) {
      const normalized = baseUrl.replace(/\/+$/, '');
      const target = normalized.endsWith('/api/v1')
        ? `${normalized}/health`
        : `${normalized}/api/v1/health`;
      return this.http.get<HealthResponse>(target);
    }
    return this.http.get<HealthResponse>(this.controlPlaneUrl('/health'));
  }

  /**
   * Checks health of the Artifact Storage service (`GET /health` returning `"OK"`).
   * @param storageUrl Optional storage service URL override.
   * @returns Observable emitting the health response text.
   */
  checkStorageHealth(storageUrl?: string): Observable<string> {
    const base = storageUrl ?? this.config.storageUrl();
    if (!base) {
      throw new Error('Offline mode active. Cannot call API.');
    }
    return this.http.get(`${base.replace(/\/+$/, '')}/health`, { responseType: 'text' });
  }

  /**
   * Gets API and ecosystem compiler versions (`GET /version`).
   * @param baseUrl Optional base URL override.
   * @returns Observable emitting the version response.
   */
  getVersion(baseUrl?: string): Observable<VersionResponse> {
    return this.http.get<VersionResponse>(this.url('/version', baseUrl));
  }

  /**
   * Registers a new user (`POST /auth/register`).
   * @param payload Registration details.
   * @returns Observable emitting the authentication response.
   */
  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.url('/auth/register'), payload);
  }

  /**
   * Logs in an existing user (`POST /auth/login`).
   * @param payload Login credentials.
   * @returns Observable emitting the authentication response.
   */
  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.url('/auth/login'), payload);
  }

  /**
   * Logs in via GitHub OAuth (`POST /auth/github`).
   * @param payload OAuth code payload.
   * @returns Observable emitting the authentication response.
   */
  loginGithub(payload: OAuthPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.url('/auth/github'), payload);
  }

  /**
   * Registers a new user directly against the Control Plane (`POST /api/v1/auth/register`).
   * @param payload Registration details.
   * @returns Observable emitting the authentication response.
   */
  registerControlPlane(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.controlPlaneUrl('/auth/register'), payload);
  }

  /**
   * Logs in an existing user directly against the Control Plane (`POST /api/v1/auth/login`).
   * @param payload Login credentials.
   * @returns Observable emitting the authentication response.
   */
  loginControlPlane(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.controlPlaneUrl('/auth/login'), payload);
  }

  /**
   * Deletes the currently authenticated user account (`DELETE /api/v1/auth/me`).
   * @param token Optional bearer authentication token.
   * @returns Observable completing when the account is deleted.
   */
  deleteAccount(token?: string): Observable<void> {
    return this.http.delete<void>(this.controlPlaneUrl('/auth/me'), this.headers(token));
  }

  /**
   * Lists organizations for the authenticated user (`GET /api/v1/orgs`).
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the list of organizations.
   */
  listOrgs(token?: string): Observable<Organization[]> {
    return this.http.get<Organization[]>(this.controlPlaneUrl('/orgs'), this.headers(token));
  }

  /**
   * Retrieves a single organization by ID (`GET /api/v1/orgs/{org_id}`).
   * @param orgId Numeric organization ID.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the organization.
   */
  getOrg(orgId: number, token?: string): Observable<Organization> {
    return this.http.get<Organization>(this.controlPlaneUrl(`/orgs/${orgId}`), this.headers(token));
  }

  /**
   * Creates a new organization (`POST /orgs`).
   * @param payload Organization creation payload.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the created organization.
   */
  createOrg(payload: OrgPayload, token?: string): Observable<Organization> {
    return this.http.post<Organization>(this.url('/orgs'), payload, this.headers(token));
  }

  /**
   * Creates a new organization directly on the Control Plane (`POST /api/v1/orgs`).
   * @param payload Organization creation payload.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the created organization.
   */
  createControlPlaneOrg(payload: OrgPayload, token?: string): Observable<Organization> {
    return this.http.post<Organization>(
      this.controlPlaneUrl('/orgs'),
      payload,
      this.headers(token),
    );
  }

  /**
   * Deletes an organization (`DELETE /api/v1/orgs/{org_id}`).
   * @param orgId Organization ID to delete.
   * @param token Optional bearer authentication token.
   * @returns Observable completing when deleted.
   */
  deleteOrg(orgId: number | string, token?: string): Observable<void> {
    return this.http.delete<void>(this.controlPlaneUrl(`/orgs/${orgId}`), this.headers(token));
  }

  /**
   * Invites a user to an organization (`POST /api/v1/orgs/{org_id}/members`).
   * @param orgId Organization ID.
   * @param payload Member invitation details (`email` and `role`).
   * @param token Optional bearer authentication token.
   * @returns Observable completing when the invitation is processed.
   */
  inviteOrgMember(
    orgId: number | string,
    payload: InviteMemberPayload,
    token?: string,
  ): Observable<void> {
    return this.http.post<void>(
      this.controlPlaneUrl(`/orgs/${orgId}/members`),
      payload,
      this.headers(token),
    );
  }

  /**
   * Lists repositories belonging to an organization (`GET /api/v1/orgs/{org_id}/repos`).
   * @param orgId Numeric organization ID.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the organization's repositories.
   */
  listRepos(orgId: number, token?: string): Observable<Repository[]> {
    return this.http.get<Repository[]>(
      this.controlPlaneUrl(`/orgs/${orgId}/repos`),
      this.headers(token),
    );
  }

  /**
   * Retrieves a repository within an organization (`GET /api/v1/orgs/{org_id}/repos/{repo_id}`).
   * @param orgId Numeric organization ID.
   * @param repoId Numeric repository ID.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the repository.
   */
  getRepo(orgId: number, repoId: number, token?: string): Observable<Repository> {
    return this.http.get<Repository>(
      this.controlPlaneUrl(`/orgs/${orgId}/repos/${repoId}`),
      this.headers(token),
    );
  }

  /**
   * Creates a new repository via gateway (`POST /repos`).
   * @param payload Repository creation payload.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the created repository.
   */
  createRepo(payload: RepoPayload, token?: string): Observable<Repository> {
    return this.http.post<Repository>(this.url('/repos'), payload, this.headers(token));
  }

  /**
   * Creates a new repository inside an organization (`POST /api/v1/orgs/{org_id}/repos`).
   * @param orgId Numeric organization ID.
   * @param payload Repository creation payload (`name`, `description`).
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the created repository.
   */
  createOrgRepo(orgId: number, payload: CreateRepoPayload, token?: string): Observable<Repository> {
    return this.http.post<Repository>(
      this.controlPlaneUrl(`/orgs/${orgId}/repos`),
      payload,
      this.headers(token),
    );
  }

  /**
   * Deletes a repository within an organization (`DELETE /api/v1/orgs/{org_id}/repos/{repo_id}`).
   * @param orgId Organization ID.
   * @param repoId Repository ID.
   * @param token Optional bearer authentication token.
   * @returns Observable completing when deleted.
   */
  deleteRepo(orgId: number | string, repoId: number | string, token?: string): Observable<void> {
    return this.http.delete<void>(
      this.controlPlaneUrl(`/orgs/${orgId}/repos/${repoId}`),
      this.headers(token),
    );
  }

  /**
   * Lists releases for a repository (`GET /api/v1/orgs/{org_id}/repos/{repo_id}/releases`).
   * @param orgId Numeric organization ID.
   * @param repoId Numeric repository ID.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the repository's releases.
   */
  listReleases(orgId: number, repoId: number, token?: string): Observable<Release[]> {
    return this.http.get<Release[]>(
      this.controlPlaneUrl(`/orgs/${orgId}/repos/${repoId}/releases`),
      this.headers(token),
    );
  }

  /**
   * Creates a new SDK release for a repository (`POST /api/v1/orgs/{org_id}/repos/{repo_id}/releases`).
   * Records an audit event and enqueues a `ReleaseSdkJob` in Redis/Valkey for `cdd-publisher`.
   * @param orgId Numeric organization ID.
   * @param repoId Numeric repository ID.
   * @param payload Release creation payload (`tag_name`, `name`, `body`).
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the created release.
   */
  createOrgRelease(
    orgId: number,
    repoId: number,
    payload: CreateReleasePayload,
    token?: string,
  ): Observable<Release> {
    return this.http.post<Release>(
      this.controlPlaneUrl(`/orgs/${orgId}/repos/${repoId}/releases`),
      payload,
      this.headers(token),
    );
  }

  /**
   * Lists provider names that have encrypted tokens stored in the Control Plane vault (`GET /api/v1/tokens`).
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the list of configured token providers.
   */
  listTokens(token?: string): Observable<TokenProvider[]> {
    return this.http.get<TokenProvider[]>(this.controlPlaneUrl('/tokens'), this.headers(token));
  }

  /**
   * Encrypts and stores a third-party registry or VCS token in the Control Plane vault (`POST /api/v1/tokens`).
   * @param payload Token provider and plaintext secret token.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the storage status response.
   */
  storeToken(
    payload: StoreTokenPayload,
    token?: string,
  ): Observable<{
    /** Status indicator returned by the control plane (`'ok'`). */
    status: string;
  }> {
    return this.http.post<{
      /** Status indicator returned by the control plane (`'ok'`). */
      status: string;
    }>(this.controlPlaneUrl('/tokens'), payload, this.headers(token));
  }

  /**
   * Deletes a stored token for the specified provider (`DELETE /api/v1/tokens/{provider}`).
   * @param provider Token provider to delete (`'github' | 'npm' | 'pypi' | 'cargo'`).
   * @param token Optional bearer authentication token.
   * @returns Observable completing when the token is removed.
   */
  deleteToken(provider: TokenProvider, token?: string): Observable<void> {
    return this.http.delete<void>(this.controlPlaneUrl(`/tokens/${provider}`), this.headers(token));
  }

  /**
   * Lists paginated audit log records for an organization (`GET /api/v1/orgs/{org_id}/audit`).
   * @param orgId Numeric organization ID.
   * @param query Optional pagination parameters (`limit`, `offset`).
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the list of audit log records.
   */
  listAuditLogs(
    orgId: number,
    query?: AuditLogQuery,
    token?: string,
  ): Observable<AuditLogRecord[]> {
    let params = new HttpParams();
    if (query?.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }
    if (query?.offset !== undefined) {
      params = params.set('offset', String(query.offset));
    }
    return this.http.get<AuditLogRecord[]>(this.controlPlaneUrl(`/orgs/${orgId}/audit`), {
      ...this.headers(token),
      params,
    });
  }

  /**
   * Reports an SDK package publishing audit telemetry event (`POST /api/v1/audit/publish`).
   * @param payload Publish audit telemetry payload (`artifact_id`, `registry`, `success`, `error_message`).
   * @param token Optional bearer authentication token.
   * @returns Observable completing when the audit report is recorded.
   */
  reportPublishAudit(payload: PublishAuditPayload, token?: string): Observable<void> {
    return this.http.post<void>(
      this.controlPlaneUrl('/audit/publish'),
      payload,
      this.headers(token),
    );
  }

  /**
   * Triggers GitHub synchronization (`POST /github/sync`).
   * @param token Optional bearer authentication token.
   * @returns Observable emitting the synchronization status.
   */
  syncGithub(token?: string): Observable<SyncStatus> {
    return this.http.post<SyncStatus>(this.url('/github/sync'), {}, this.headers(token));
  }

  /**
   * Sends an HMAC-signed GitHub webhook event to the gateway (`POST /github/webhook`).
   * @param payload Raw JSON webhook body string.
   * @param signature HMAC-SHA256 signature header value (`sha256=...`).
   * @returns Observable emitting the webhook verification response.
   */
  sendGithubWebhook(payload: string, signature: string): Observable<WebhookResponse> {
    return this.http.post<WebhookResponse>(this.url('/github/webhook'), payload, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature,
      }),
    });
  }

  /**
   * Creates a GitHub release (`POST /github/releases`).
   * @param payload Release creation payload.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting an optional status message.
   */
  createRelease(
    payload: ReleasePayload | GithubReleasePayload,
    token?: string,
  ): Observable<{
    /** Optional status message returned by the server. */
    message?: string;
  }> {
    return this.http.post(this.url('/github/releases'), payload, this.headers(token));
  }

  /**
   * Creates a GitHub release using owner/repo fields (`POST /github/releases`).
   * @param payload GitHub release creation payload.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting an optional status message.
   */
  createGithubRelease(
    payload: GithubReleasePayload,
    token?: string,
  ): Observable<{
    /** Optional status message returned by the server. */
    message?: string;
  }> {
    return this.http.post(this.url('/github/releases'), payload, this.headers(token));
  }

  /**
   * Dispatches a GitHub Actions workflow via the gateway canonical route (`POST /github/actions/dispatch`).
   * @param payload Strongly-typed workflow dispatch payload.
   * @param token Optional bearer authentication token.
   * @returns Observable completing when the workflow is dispatched.
   */
  dispatchGithubWorkflow(payload: TriggerWorkflowPayload, token?: string): Observable<void> {
    return this.http.post<void>(this.url('/github/actions/dispatch'), payload, this.headers(token));
  }

  /**
   * Triggers a GitHub Actions workflow (`POST /github/actions/workflows/trigger`).
   * @param payload Workflow trigger payload.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting an optional status message.
   */
  triggerAction(
    payload: TriggerPayload | TriggerWorkflowPayload,
    token?: string,
  ): Observable<{
    /** Optional status message returned by the server. */
    message?: string;
  }> {
    return this.http.post(
      this.url('/github/actions/workflows/trigger'),
      payload,
      this.headers(token),
    );
  }

  /**
   * Triggers a GitHub Actions workflow using owner/repo/workflow_id/ref_branch (`POST /github/actions/workflows/trigger`).
   * @param payload Strongly-typed workflow dispatch payload.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting an optional status message.
   */
  triggerGithubWorkflow(
    payload: TriggerWorkflowPayload,
    token?: string,
  ): Observable<{
    /** Optional status message returned by the server. */
    message?: string;
  }> {
    return this.http.post(
      this.url('/github/actions/workflows/trigger'),
      payload,
      this.headers(token),
    );
  }

  /**
   * Encrypts and stores a repository secret via the gateway canonical route (`POST /github/secrets`).
   * @param payload Strongly-typed GitHub secret payload.
   * @param token Optional bearer authentication token.
   * @returns Observable completing when the secret is stored.
   */
  storeGithubSecret(payload: CreateGithubSecretPayload, token?: string): Observable<void> {
    return this.http.post<void>(this.url('/github/secrets'), payload, this.headers(token));
  }

  /**
   * Creates a GitHub Actions secret (`POST /github/actions/secrets`).
   * @param payload Secret creation payload.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting an optional status message.
   */
  createSecret(
    payload: SecretPayload | CreateGithubSecretPayload,
    token?: string,
  ): Observable<{
    /** Optional status message returned by the server. */
    message?: string;
  }> {
    return this.http.post(this.url('/github/actions/secrets'), payload, this.headers(token));
  }

  /**
   * Creates or updates a GitHub Actions secret using owner/repo/secret_name/secret_value (`POST /github/actions/secrets`).
   * @param payload Strongly-typed GitHub secret payload.
   * @param token Optional bearer authentication token.
   * @returns Observable emitting an optional status message.
   */
  createGithubSecret(
    payload: CreateGithubSecretPayload,
    token?: string,
  ): Observable<{
    /** Optional status message returned by the server. */
    message?: string;
  }> {
    return this.http.post(this.url('/github/actions/secrets'), payload, this.headers(token));
  }
}
