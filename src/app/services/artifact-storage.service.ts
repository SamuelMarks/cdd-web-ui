/**
 * Artifact Storage client service for uploading, downloading, and deleting SDK and API Docs artifacts on `cdd-storage`.
 * @module app/services/artifact-storage.service
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BackendConfigService } from './backend-config.service';

/**
 * Service communicating with the `cdd-storage` microservice (`POST /upload/...`, `GET /artifact/...`, `DELETE /artifact/...`)
 * and resolving hosted `cdd-docs-ui` documentation preview links.
 */
@Injectable({
  providedIn: 'root',
})
export class ArtifactStorageService {
  /** Injected Angular HttpClient. */
  private readonly http = inject(HttpClient);
  /** Injected BackendConfigService for resolving `storageUrl` and `docsUiUrl`. */
  private readonly config = inject(BackendConfigService);

  /**
   * Resolves the base URL of the `cdd-storage` microservice or throws if offline.
   * @returns Normalized `cdd-storage` base URL.
   */
  private getBaseUrl(): string {
    const storageUrl = this.config.storageUrl();
    if (!storageUrl) {
      throw new Error('Offline mode active. Cannot call Artifact Storage service.');
    }
    return storageUrl.replace(/\/+$/, '');
  }

  /**
   * Builds optional Authorization Bearer headers when an explicit token is supplied.
   * @param token Optional Bearer token or storage API key.
   * @param extra Optional additional HTTP header key-value pairs.
   * @returns HTTP headers instance.
   */
  private buildHeaders(token?: string, extra?: Record<string, string>): HttpHeaders {
    let headers = new HttpHeaders(extra ?? {});
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /**
   * Uploads the default versioned binary artifact (`POST /upload/{org_id}/{repo_id}/{version}`).
   * @param orgId Organization identifier (`1..=64` chars).
   * @param repoId Repository identifier (`1..=64` chars).
   * @param version Semantic version or tag (`1..=32` chars).
   * @param body Non-empty binary artifact payload (`Blob`, `ArrayBuffer`, or string).
   * @param token Optional Bearer token or storage API key.
   * @returns Observable completing when the upload succeeds (`201 Created`).
   */
  uploadVersionArtifact(
    orgId: string,
    repoId: string,
    version: string,
    body: Blob | ArrayBuffer | string,
    token?: string,
  ): Observable<void> {
    const url = `${this.getBaseUrl()}/upload/${encodeURIComponent(orgId)}/${encodeURIComponent(repoId)}/${encodeURIComponent(version)}`;
    return this.http.post<void>(url, body, {
      headers: this.buildHeaders(token),
    });
  }

  /**
   * Uploads a named file artifact under a specific version (`POST /upload/{org_id}/{repo_id}/{version}/{file_path}`).
   * @param orgId Organization identifier.
   * @param repoId Repository identifier.
   * @param version Version string (e.g., `'v1.0.0'` or `'latest'`).
   * @param filePath Relative artifact file path (e.g., `'docs.json'` or `'openapi.json'`).
   * @param body Non-empty file content (`Blob`, `ArrayBuffer`, or string).
   * @param token Optional Bearer token or storage API key.
   * @returns Observable completing when the upload succeeds (`201 Created`).
   */
  uploadFileArtifact(
    orgId: string,
    repoId: string,
    version: string,
    filePath: string,
    body: Blob | ArrayBuffer | string,
    token?: string,
  ): Observable<void> {
    const cleanPath = filePath.replace(/^\/+/, '');
    const url = `${this.getBaseUrl()}/upload/${encodeURIComponent(orgId)}/${encodeURIComponent(repoId)}/${encodeURIComponent(version)}/${cleanPath}`;
    return this.http.post<void>(url, body, {
      headers: this.buildHeaders(token),
    });
  }

  /**
   * Downloads an artifact from `cdd-storage` (`GET /artifact/{org_id}/{repo_id}/{file_path}`),
   * optionally sending `If-None-Match` for `304 Not Modified` caching.
   * @param orgId Organization identifier.
   * @param repoId Repository identifier.
   * @param filePath Relative artifact path including version (e.g., `'v1.0.0/docs.json'`).
   * @param etag Optional ETag value for `If-None-Match` conditional requests.
   * @returns Observable emitting the full `HttpResponse<ArrayBuffer>` including `ETag` and `Cache-Control` headers.
   */
  downloadArtifact(
    orgId: string,
    repoId: string,
    filePath: string,
    etag?: string,
  ): Observable<HttpResponse<ArrayBuffer>> {
    const cleanPath = filePath.replace(/^\/+/, '');
    const url = `${this.getBaseUrl()}/artifact/${encodeURIComponent(orgId)}/${encodeURIComponent(repoId)}/${cleanPath}`;
    const extra: Record<string, string> = etag ? { 'If-None-Match': etag } : {};
    return this.http.get(url, {
      headers: this.buildHeaders(undefined, extra),
      observe: 'response',
      responseType: 'arraybuffer',
    });
  }

  /**
   * Deletes an artifact from `cdd-storage` (`DELETE /artifact/{org_id}/{repo_id}/{file_path}`).
   * @param orgId Organization identifier.
   * @param repoId Repository identifier.
   * @param filePath Relative artifact path including version (e.g., `'v1.0.0/docs.json'`).
   * @param token Optional Bearer token or storage API key.
   * @returns Observable completing when the artifact is deleted (`204 No Content`).
   */
  deleteArtifact(
    orgId: string,
    repoId: string,
    filePath: string,
    token?: string,
  ): Observable<void> {
    const cleanPath = filePath.replace(/^\/+/, '');
    const url = `${this.getBaseUrl()}/artifact/${encodeURIComponent(orgId)}/${encodeURIComponent(repoId)}/${cleanPath}`;
    return this.http.delete<void>(url, {
      headers: this.buildHeaders(token),
    });
  }

  /**
   * Constructs the public hosted API documentation URL on `cdd-docs-ui` pointing to a stored artifact.
   * @param orgId Organization identifier.
   * @param repoId Repository identifier.
   * @param version Version string.
   * @param filePath File path within the version (defaults to `'docs.json'`).
   * @returns Full URL to `cdd-docs-ui` with `?spec=` pointing to the artifact in `cdd-storage`.
   */
  getHostedDocsUrl(
    orgId: string,
    repoId: string,
    version: string,
    filePath: string = 'docs.json',
  ): string {
    const docsUiBase = this.config.docsUiUrl();
    if (!docsUiBase) {
      throw new Error('Offline mode active. Cannot construct hosted docs URL.');
    }
    const cleanPath = filePath.replace(/^\/+/, '');
    const artifactUrl = `${this.getBaseUrl()}/artifact/${encodeURIComponent(orgId)}/${encodeURIComponent(repoId)}/${encodeURIComponent(version)}/${cleanPath}`;
    return `${docsUiBase.replace(/\/+$/, '')}/?spec=${encodeURIComponent(artifactUrl)}`;
  }
}
