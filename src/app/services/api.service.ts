/**
 * HTTP API service for communicating with the CDD backend control plane.
 * @module app/services/api.service
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BackendConfigService } from './backend-config.service';
import { Organization, Repository } from '../models/types';

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
export interface OrgPayload {
  /** The name of the organization. */
  login: string;
  /** An optional description of the organization. */
  description?: string;
}

/** Payload for Repository creation. */
export interface RepoPayload {
  /** The organization ID that will own the repo. */
  organization_id: number;
  /** The name of the repository. */
  name: string;
  /** An optional description for the repository. */
  description?: string;
}

/** Response for version. */
export interface VersionResponse {
  /** The API version. */
  version: string;
}

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
 * Service to handle communication with the CDD backend API.
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
   * Helper to construct the full URL.
   * @param path API endpoint path.
   * @returns Full URL string.
   */
  private url(path: string): string {
    const baseUrl = this.config.backendUrl();
    if (!baseUrl) throw new Error('Offline mode active. Cannot call API.');
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }

  /**
   * Helper to append auth token.
   * @param token JWT token.
   * @returns HttpHeaders with Bearer auth.
   */
  private headers(token: string): {
    /** HTTP request headers containing the Authorization Bearer token. */
    headers: HttpHeaders;
  } {
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  /** Gets API version. */
  getVersion(): Observable<VersionResponse> {
    return this.http.get<VersionResponse>(this.url('/version'));
  }

  /**
   * Registers a new user.
   * @param payload Registration details.
   * @returns Observable emitting the authentication response.
   */
  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.url('/auth/register'), payload);
  }

  /**
   * Logs in an existing user.
   * @param payload Login credentials.
   * @returns Observable emitting the authentication response.
   */
  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.url('/auth/login'), payload);
  }

  /**
   * Logs in via GitHub OAuth.
   * @param payload OAuth code payload.
   * @returns Observable emitting the authentication response.
   */
  loginGithub(payload: OAuthPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.url('/auth/github'), payload);
  }

  /**
   * Creates a new organization.
   * @param payload Organization creation payload.
   * @param token Bearer authentication token.
   * @returns Observable emitting the created organization.
   */
  createOrg(payload: OrgPayload, token: string): Observable<Organization> {
    return this.http.post<Organization>(this.url('/orgs'), payload, this.headers(token));
  }

  /**
   * Creates a new repository.
   * @param payload Repository creation payload.
   * @param token Bearer authentication token.
   * @returns Observable emitting the created repository.
   */
  createRepo(payload: RepoPayload, token: string): Observable<Repository> {
    return this.http.post<Repository>(this.url('/repos'), payload, this.headers(token));
  }

  /**
   * Triggers GitHub sync.
   * @param token Bearer authentication token.
   * @returns Observable emitting an optional status message.
   */
  syncGithub(token: string): Observable<{
    /** Optional status message returned by the server. */
    message?: string;
  }> {
    return this.http.post(this.url('/github/sync'), {}, this.headers(token));
  }

  /**
   * Creates a GitHub release.
   * @param payload Release creation payload.
   * @param token Bearer authentication token.
   * @returns Observable emitting an optional status message.
   */
  createRelease(
    payload: ReleasePayload,
    token: string,
  ): Observable<{
    /** Optional status message returned by the server. */
    message?: string;
  }> {
    return this.http.post(this.url('/github/releases'), payload, this.headers(token));
  }

  /**
   * Triggers a GitHub action.
   * @param payload Workflow trigger payload.
   * @param token Bearer authentication token.
   * @returns Observable emitting an optional status message.
   */
  triggerAction(
    payload: TriggerPayload,
    token: string,
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
   * Creates a GitHub secret.
   * @param payload Secret creation payload.
   * @param token Bearer authentication token.
   * @returns Observable emitting an optional status message.
   */
  createSecret(
    payload: SecretPayload,
    token: string,
  ): Observable<{
    /** Optional status message returned by the server. */
    message?: string;
  }> {
    return this.http.post(this.url('/github/actions/secrets'), payload, this.headers(token));
  }
}
