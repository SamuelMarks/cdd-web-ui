/**
 * Backend configuration service for online/offline mode and execution targets.
 * @module app/services/backend-config.service
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import {
  ConnectionStatus,
  RunMode,
  ServiceEndpointOverrides,
  VersionResponse,
} from '../models/types';
import { WINDOW } from '../tokens';

/**
 * Service to manage backend connection configuration (Online vs Offline mode),
 * multi-service topology endpoint discovery (`cdd-gateway`, `cdd-control-plane`,
 * `cdd-engine`, `cdd-storage`, `cdd-docs-ui`), and the execution run mode.
 */
@Injectable({
  providedIn: 'root',
})
/** BackendConfigService */
export class BackendConfigService {
  /** The local storage key for the backend URL. */
  private readonly BACKEND_URL_KEY = 'cdd_backend_url';
  /** The local storage key for the run mode. */
  private readonly RUN_MODE_KEY = 'cdd_run_mode';
  /** The local storage key for per-service endpoint overrides. */
  private readonly OVERRIDES_KEY = 'cdd_service_overrides';

  /** The injected WINDOW token. */
  private readonly window = inject(WINDOW);

  /** Signal holding the current backend URL. Null means offline mode. */
  readonly backendUrl = signal<string | null>(this.loadFromStorage());

  /** Signal holding the current execution mode. */
  readonly runMode = signal<RunMode>(this.loadRunMode());

  /** Signal holding optional per-service endpoint URL overrides. */
  readonly serviceOverrides = signal<ServiceEndpointOverrides>(this.loadOverrides());

  /** Signal holding the current backend connection status. */
  readonly connectionStatus = signal<ConnectionStatus>(
    this.backendUrl() !== null ? 'connected' : 'disconnected',
  );

  /** Signal holding the detected gateway version string when online. */
  readonly gatewayVersion = signal<string | null>(null);

  /** Signal holding detected compiler versions keyed by ecosystem identifier. */
  readonly ecosystemVersions = signal<Record<string, string>>({});

  /** Computed signal indicating whether the application is currently in online mode. */
  readonly isOnline = computed<boolean>(() => this.backendUrl() !== null);

  /** Computed signal resolving the primary API Gateway base URL. */
  readonly gatewayUrl = computed<string | null>(() => this.backendUrl());

  /** Computed signal resolving the Control Plane REST API base URL (`/api/v1`). */
  readonly controlPlaneUrl = computed<string | null>(() => {
    const override = this.serviceOverrides().controlPlaneUrl;
    if (override) {
      return override;
    }
    const base = this.backendUrl();
    if (!base) {
      return null;
    }
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  });

  /** Computed signal resolving the Authentication base URL (`/auth`). */
  readonly authBaseUrl = computed<string | null>(() => {
    const base = this.backendUrl();
    if (!base) {
      return null;
    }
    return `${base}/auth`;
  });

  /** Computed signal resolving the JSON-RPC 2.0 endpoint URL (`/rpc`). */
  readonly rpcUrl = computed<string | null>(() => {
    const base = this.backendUrl();
    if (!base) {
      return null;
    }
    return `${base}/rpc`;
  });

  /** Computed signal resolving the Model Context Protocol SSE endpoint URL (`/mcp/sse`). */
  readonly mcpSseUrl = computed<string | null>(() => {
    const base = this.backendUrl();
    if (!base) {
      return null;
    }
    return `${base}/mcp/sse`;
  });

  /** Computed signal resolving the Model Context Protocol message endpoint URL (`/mcp/message`). */
  readonly mcpMessageUrl = computed<string | null>(() => {
    const base = this.backendUrl();
    if (!base) {
      return null;
    }
    return `${base}/mcp/message`;
  });

  /** Computed signal resolving the Artifact Storage service base URL (`cdd-storage`). */
  readonly storageUrl = computed<string | null>(() => {
    const override = this.serviceOverrides().storageUrl;
    if (override) {
      return override;
    }
    const base = this.backendUrl();
    if (!base) {
      return null;
    }
    return `${base}/storage`;
  });

  /** Computed signal resolving the hosted API Documentation UI base URL (`cdd-docs-ui`). */
  readonly docsUiUrl = computed<string | null>(() => {
    const override = this.serviceOverrides().docsUiUrl;
    if (override) {
      return override;
    }
    const base = this.backendUrl();
    if (!base) {
      return null;
    }
    return `${base}/docs`;
  });

  /**
   * Initializes the backend configuration service.
   */
  constructor() {}

  /**
   * Validates and normalizes an HTTP/HTTPS URL, stripping trailing slashes.
   * @param rawUrl The raw URL string to validate.
   * @returns The normalized URL string without trailing slashes.
   */
  normalizeUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error('Invalid URL provided for backend config.');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid URL provided for backend config.');
    }
    return trimmed.replace(/\/+$/, '');
  }

  /**
   * Retrieves the backend URL from URL query parameters (`?backendUrl=...`) or local storage.
   * @returns The saved or query-supplied URL, or null if none is present.
   */
  private loadFromStorage(): string | null {
    const search = this.window?.location?.search;
    if (search) {
      const params = new URLSearchParams(search);
      const queryUrl = params.get('backendUrl');
      if (queryUrl) {
        try {
          const normalized = this.normalizeUrl(queryUrl);
          localStorage.setItem(this.BACKEND_URL_KEY, normalized);
          return normalized;
        } catch {
          // Ignore invalid query parameter and fall back to localStorage
        }
      }
    }
    const stored = localStorage.getItem(this.BACKEND_URL_KEY);
    return stored ? stored.replace(/\/+$/, '') : null;
  }

  /**
   * Loads optional per-service endpoint overrides from local storage.
   * @returns The parsed `ServiceEndpointOverrides` object.
   */
  private loadOverrides(): ServiceEndpointOverrides {
    const raw = localStorage.getItem(this.OVERRIDES_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        return {
          controlPlaneUrl:
            typeof record['controlPlaneUrl'] === 'string' ? record['controlPlaneUrl'] : null,
          storageUrl: typeof record['storageUrl'] === 'string' ? record['storageUrl'] : null,
          docsUiUrl: typeof record['docsUiUrl'] === 'string' ? record['docsUiUrl'] : null,
        };
      }
    } catch {
      // Ignore malformed JSON in localStorage
    }
    return {};
  }

  /**
   * Gets the current hostname from the injected window location.
   * @returns The current hostname string, or undefined if unavailable.
   */
  _getHostname(): string | undefined {
    return this.window ? this.window.location.hostname : undefined;
  }

  /**
   * Retrieves the run mode from local storage.
   * @returns The saved run mode, defaulting to `local_relative` on localhost or `served_github` remotely.
   */
  private loadRunMode(): RunMode {
    const stored = localStorage.getItem(this.RUN_MODE_KEY);
    if (
      stored === 'local_relative' ||
      stored === 'local_cdd_ctl_wasm' ||
      stored === 'local_cdd_ctl_native' ||
      stored === 'served_github'
    ) {
      return stored;
    }

    const hostname = this._getHostname();
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return 'served_github';
    }

    return 'local_relative';
  }

  /**
   * Sets the execution run mode.
   * @param mode The selected run mode.
   */
  setRunMode(mode: RunMode): void {
    this.runMode.set(mode);
    localStorage.setItem(this.RUN_MODE_KEY, mode);
  }

  /**
   * Enables online mode by validating and setting the backend URL.
   * @param url The URL of the backend API (`cdd-gateway` or `cdd-control-plane`).
   */
  setOnlineMode(url: string): void {
    const normalized = this.normalizeUrl(url);
    this.backendUrl.set(normalized);
    this.connectionStatus.set('connected');
    localStorage.setItem(this.BACKEND_URL_KEY, normalized);
  }

  /**
   * Updates optional per-service endpoint URL overrides (`controlPlaneUrl`, `storageUrl`, `docsUiUrl`).
   * @param overrides The service endpoint overrides to apply.
   */
  setServiceOverrides(overrides: ServiceEndpointOverrides): void {
    const normalized: ServiceEndpointOverrides = {
      controlPlaneUrl: overrides.controlPlaneUrl
        ? this.normalizeUrl(overrides.controlPlaneUrl)
        : null,
      storageUrl: overrides.storageUrl ? this.normalizeUrl(overrides.storageUrl) : null,
      docsUiUrl: overrides.docsUiUrl ? this.normalizeUrl(overrides.docsUiUrl) : null,
    };
    this.serviceOverrides.set(normalized);
    localStorage.setItem(this.OVERRIDES_KEY, JSON.stringify(normalized));
  }

  /**
   * Updates the current connection status signal.
   * @param status The new connection status.
   */
  setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus.set(status);
  }

  /**
   * Stores version metadata retrieved from `GET /version` or JSON-RPC `version`.
   * @param info The version response payload from the backend.
   */
  setVersionInfo(info: VersionResponse): void {
    this.gatewayVersion.set(info.gateway ?? info.version ?? null);
    this.ecosystemVersions.set(info.ecosystem ?? {});
  }

  /**
   * Disables online mode, reverting the application to offline mode.
   */
  setOfflineMode(): void {
    this.backendUrl.set(null);
    this.connectionStatus.set('disconnected');
    this.gatewayVersion.set(null);
    this.ecosystemVersions.set({});
    localStorage.removeItem(this.BACKEND_URL_KEY);
  }
}
