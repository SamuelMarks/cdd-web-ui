/**
 * JSON-RPC 2.0 and Model Context Protocol (MCP) client service for `cdd-gateway` and `cdd-engine`.
 * @module app/services/mcp-rpc.service
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BackendConfigService } from './backend-config.service';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  McpCallToolResult,
  McpGenerateSdkArguments,
  McpInitializeResult,
  McpListToolsResult,
  Organization,
  Repository,
  VersionResponse,
} from '../models/types';

/**
 * Service providing JSON-RPC 2.0 (`/rpc`) and Model Context Protocol (`/mcp/message`)
 * communication with `cdd-gateway` and `cdd-engine`.
 */
@Injectable({
  providedIn: 'root',
})
export class McpRpcService {
  /** Injected Angular HttpClient. */
  private readonly http = inject(HttpClient);
  /** Injected BackendConfigService for resolving `/rpc` and `/mcp/message` URLs. */
  private readonly config = inject(BackendConfigService);
  /** Monotonically increasing request ID counter for JSON-RPC 2.0 envelopes. */
  private nextRequestId = 1;

  /**
   * Resolves the JSON-RPC 2.0 endpoint URL (`/rpc`) or throws if offline.
   * @returns The full `/rpc` endpoint URL.
   */
  private getRpcUrl(): string {
    const rpcUrl = this.config.rpcUrl();
    if (!rpcUrl) {
      throw new Error('Offline mode active. Cannot call JSON-RPC endpoint.');
    }
    return rpcUrl;
  }

  /**
   * Resolves the MCP message endpoint URL (`/mcp/message`) or throws if offline.
   * @returns The full `/mcp/message` endpoint URL.
   */
  private getMcpMessageUrl(): string {
    const mcpUrl = this.config.mcpMessageUrl();
    if (!mcpUrl) {
      throw new Error('Offline mode active. Cannot call MCP endpoint.');
    }
    return mcpUrl;
  }

  /**
   * Initiates the Model Context Protocol (MCP) Server-Sent Events stream (`GET /mcp/sse`)
   * and returns the negotiated message endpoint path.
   * @returns Observable emitting the raw SSE handshake payload.
   */
  connectMcpSse(): Observable<string> {
    const sseUrl = this.config.mcpSseUrl();
    if (!sseUrl) {
      throw new Error('Offline mode active. Cannot call MCP SSE endpoint.');
    }
    return this.http.get(sseUrl, { responseType: 'text' });
  }

  /**
   * Sends a generic JSON-RPC 2.0 request to `POST /rpc` and unwraps the `result` field.
   * @param method The JSON-RPC method name.
   * @param params Optional structured parameters object.
   * @returns Observable emitting the unwrapped result `R` or throwing an Error if `response.error` is set.
   */
  callRpc<R = unknown, P = Record<string, unknown>>(method: string, params?: P): Observable<R> {
    const request: JsonRpcRequest<P> = {
      jsonrpc: '2.0',
      id: this.nextRequestId++,
      method,
      ...(params !== undefined ? { params } : {}),
    };
    return this.http.post<JsonRpcResponse<R>>(this.getRpcUrl(), request).pipe(
      map((res) => {
        if (res.error) {
          throw new Error(res.error.message || `JSON-RPC error ${res.error.code}`);
        }
        return res.result as R;
      }),
    );
  }

  /**
   * Calls JSON-RPC `ping` on `cdd-gateway` (`POST /rpc`).
   * @returns Observable emitting `'pong'`.
   */
  rpcPing(): Observable<string> {
    return this.callRpc<string>('ping');
  }

  /**
   * Calls JSON-RPC `version` on `cdd-gateway` (`POST /rpc`).
   * @returns Observable emitting the gateway and ecosystem version map.
   */
  rpcVersion(): Observable<VersionResponse> {
    return this.callRpc<VersionResponse>('version');
  }

  /**
   * Calls JSON-RPC `to_docs_json` on `cdd-gateway` (`POST /rpc`) to generate CLI/SDK documentation JSON.
   * @param params Parameters specifying `target_language`, `input`, and optional `no_imports` / `no_wrapping`.
   * @returns Observable emitting the parsed documentation JSON object.
   */
  rpcToDocsJson(params: {
    /** Target ecosystem or language identifier (e.g., `'rust'`, `'typescript'`). */
    target_language: string;
    /** Raw OpenAPI specification string. */
    input: string;
    /** Whether to omit import statements in code snippets. */
    no_imports?: boolean;
    /** Whether to omit boilerplate wrapper code in snippets. */
    no_wrapping?: boolean;
  }): Observable<unknown> {
    return this.callRpc<unknown, typeof params>('to_docs_json', params);
  }

  /**
   * Calls JSON-RPC `get_organization` on `cdd-gateway` (`POST /rpc`).
   * @param orgId Numeric organization ID.
   * @returns Observable emitting the organization record.
   */
  rpcGetOrganization(orgId: number): Observable<Organization> {
    return this.callRpc<
      Organization,
      {
        /** Organization ID. */
        org_id: number;
      }
    >('get_organization', { org_id: orgId });
  }

  /**
   * Calls JSON-RPC `get_repository` on `cdd-gateway` (`POST /rpc`).
   * @param repoId Numeric repository ID.
   * @returns Observable emitting the repository record.
   */
  rpcGetRepository(repoId: number): Observable<Repository> {
    return this.callRpc<
      Repository,
      {
        /** Repository ID. */
        repo_id: number;
      }
    >('get_repository', {
      repo_id: repoId,
    });
  }

  /**
   * Calls JSON-RPC `get_user_role` on `cdd-gateway` (`POST /rpc`).
   * @param orgId Numeric organization ID.
   * @param userId Numeric user ID.
   * @returns Observable emitting the user's role string or null.
   */
  rpcGetUserRole(orgId: number, userId: number): Observable<string | null> {
    return this.callRpc<
      string | null,
      {
        /** Organization ID. */
        org_id: number;
        /** User ID. */
        user_id: number;
      }
    >('get_user_role', {
      org_id: orgId,
      user_id: userId,
    });
  }

  /**
   * Calls JSON-RPC `create_organization` on `cdd-gateway` (`POST /rpc`).
   * @param params Organization creation parameters (`login`, `description`, `github_id`).
   * @returns Observable emitting the created organization.
   */
  rpcCreateOrganization(params: {
    /** Organization login handle. */
    login: string;
    /** Optional description. */
    description?: string;
    /** Optional GitHub organization ID. */
    github_id?: number;
  }): Observable<Organization> {
    return this.callRpc<Organization, typeof params>('create_organization', params);
  }

  /**
   * Calls JSON-RPC `create_repository` on `cdd-gateway` (`POST /rpc`).
   * @param params Repository creation parameters (`org_id`, `name`, `description`, `github_id`).
   * @returns Observable emitting the created repository.
   */
  rpcCreateRepository(params: {
    /** Owning organization ID. */
    org_id: number;
    /** Repository name. */
    name: string;
    /** Optional description. */
    description?: string;
    /** Optional GitHub repository ID. */
    github_id?: number;
  }): Observable<Repository> {
    return this.callRpc<Repository, typeof params>('create_repository', params);
  }

  /**
   * Sends a JSON-RPC 2.0 message to the Model Context Protocol endpoint (`POST /mcp/message`).
   * @param method MCP method name (`'initialize'`, `'tools/list'`, `'tools/call'`).
   * @param params Optional structured MCP parameters.
   * @returns Observable emitting the unwrapped MCP result `R`.
   */
  callMcp<R = unknown, P = Record<string, unknown>>(method: string, params?: P): Observable<R> {
    const request: JsonRpcRequest<P> = {
      jsonrpc: '2.0',
      id: this.nextRequestId++,
      method,
      ...(params !== undefined ? { params } : {}),
    };
    return this.http.post<JsonRpcResponse<R>>(this.getMcpMessageUrl(), request).pipe(
      map((res) => {
        if (res.error) {
          throw new Error(res.error.message || `MCP error ${res.error.code}`);
        }
        return res.result as R;
      }),
    );
  }

  /**
   * Initializes the MCP session with `cdd-gateway` / `cdd-engine` (`method: 'initialize'`).
   * @returns Observable emitting the MCP server initialization result.
   */
  mcpInitialize(): Observable<McpInitializeResult> {
    return this.callMcp<
      McpInitializeResult,
      {
        /** Requested MCP protocol version. */
        protocolVersion: string;
        /** Client capabilities map. */
        capabilities: Record<string, unknown>;
        /** Client metadata. */
        clientInfo: {
          /** Client application name. */
          name: string;
          /** Client application version. */
          version: string;
        };
      }
    >('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'cdd-web-ui', version: '0.0.4' },
    });
  }

  /**
   * Sends a `ping` request over MCP (`POST /mcp/message`).
   * @returns Observable emitting the empty acknowledgement object.
   */
  mcpPing(): Observable<Record<string, unknown>> {
    return this.callMcp<Record<string, unknown>>('ping');
  }

  /**
   * Lists all available compiler tools exposed by `cdd-engine` (`method: 'tools/list'`).
   * @returns Observable emitting the list of MCP tools.
   */
  mcpListTools(): Observable<McpListToolsResult> {
    return this.callMcp<McpListToolsResult>('tools/list');
  }

  /**
   * Executes a remote compiler tool on `cdd-engine` via MCP (`method: 'tools/call'`).
   * @param name Tool name (e.g., `'cdd-rust'`, `'to_sdk'`).
   * @param args Tool input arguments map.
   * @returns Observable emitting the tool execution content blocks.
   */
  mcpCallTool(name: string, args: Record<string, unknown>): Observable<McpCallToolResult> {
    return this.callMcp<
      McpCallToolResult,
      {
        /** Target MCP tool name. */
        name: string;
        /** Tool input arguments. */
        arguments: Record<string, unknown>;
      }
    >('tools/call', {
      name,
      arguments: args,
    });
  }

  /**
   * Invokes the canonical `cdd_generate_sdk` MCP tool on `cdd-engine` (`POST /mcp/message`).
   * @param args Strongly-typed `cdd_generate_sdk` arguments (`target_language`, `input`, `output`).
   * @returns Observable emitting the MCP tool execution result.
   */
  mcpGenerateSdk(args: McpGenerateSdkArguments): Observable<McpCallToolResult> {
    return this.mcpCallTool('cdd_generate_sdk', {
      target_language: args.target_language,
      ...(args.input !== undefined ? { input: args.input } : {}),
      ...(args.output !== undefined ? { output: args.output } : {}),
    });
  }
}
