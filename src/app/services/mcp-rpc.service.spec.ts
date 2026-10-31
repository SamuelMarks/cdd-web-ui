import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpRpcService } from './mcp-rpc.service';
import { BackendConfigService } from './backend-config.service';

describe('McpRpcService', () => {
  let service: McpRpcService;
  let httpMock: HttpTestingController;
  let config: BackendConfigService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(McpRpcService);
    httpMock = TestBed.inject(HttpTestingController);
    config = TestBed.inject(BackendConfigService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should throw when calling RPC or MCP while offline', () => {
    expect(() => service.rpcVersion()).toThrowError(
      'Offline mode active. Cannot call JSON-RPC endpoint.',
    );
    expect(() => service.mcpListTools()).toThrowError(
      'Offline mode active. Cannot call MCP endpoint.',
    );
    expect(() => service.connectMcpSse()).toThrowError(
      'Offline mode active. Cannot call MCP SSE endpoint.',
    );
  });

  describe('when online', () => {
    const baseUrl = 'http://localhost:8086';

    beforeEach(() => {
      config.setOnlineMode(baseUrl);
    });

    it('should execute connectMcpSse, rpcPing, rpcVersion, rpcToDocsJson, rpcGetOrganization, rpcGetRepository, rpcGetUserRole, rpcCreateOrganization, and rpcCreateRepository', () => {
      service.connectMcpSse().subscribe((sse) => {
        expect(sse).toContain('/mcp/message');
      });
      const sseReq = httpMock.expectOne(`${baseUrl}/mcp/sse`);
      expect(sseReq.request.method).toBe('GET');
      sseReq.flush('event: endpoint\ndata: /mcp/message\n\n');

      service.rpcPing().subscribe((pong) => {
        expect(pong).toBe('pong');
      });
      const pingReq = httpMock.expectOne(`${baseUrl}/rpc`);
      expect(pingReq.request.body.method).toBe('ping');
      pingReq.flush({ jsonrpc: '2.0', id: 1, result: 'pong' });

      service.rpcVersion().subscribe((ver) => {
        expect(ver.gateway).toBe('0.1.0');
      });
      const r1 = httpMock.expectOne(`${baseUrl}/rpc`);
      expect(r1.request.body.method).toBe('version');
      r1.flush({ jsonrpc: '2.0', id: 2, result: { gateway: '0.1.0' } });

      service
        .rpcToDocsJson({ target_language: 'rust', input: '{}', no_imports: true })
        .subscribe((docs) => {
          expect(docs).toEqual({ endpoints: [] });
        });
      const r2 = httpMock.expectOne(`${baseUrl}/rpc`);
      expect(r2.request.body.method).toBe('to_docs_json');
      r2.flush({ jsonrpc: '2.0', id: 2, result: { endpoints: [] } });

      service.rpcGetOrganization(1).subscribe((org) => {
        expect(org.login).toBe('acme');
      });
      httpMock
        .expectOne(`${baseUrl}/rpc`)
        .flush({ jsonrpc: '2.0', id: 3, result: { id: 1, login: 'acme' } });

      service.rpcGetRepository(2).subscribe((repo) => {
        expect(repo.name).toBe('sdk');
      });
      httpMock
        .expectOne(`${baseUrl}/rpc`)
        .flush({ jsonrpc: '2.0', id: 4, result: { id: 2, name: 'sdk' } });

      service.rpcGetUserRole(1, 10).subscribe((role) => {
        expect(role).toBe('owner');
      });
      httpMock.expectOne(`${baseUrl}/rpc`).flush({ jsonrpc: '2.0', id: 5, result: 'owner' });

      service.rpcCreateOrganization({ login: 'new-org', description: 'desc' }).subscribe((org) => {
        expect(org.login).toBe('new-org');
      });
      httpMock
        .expectOne(`${baseUrl}/rpc`)
        .flush({ jsonrpc: '2.0', id: 6, result: { id: 3, login: 'new-org' } });

      service.rpcCreateRepository({ org_id: 3, name: 'new-repo' }).subscribe((repo) => {
        expect(repo.name).toBe('new-repo');
      });
      httpMock
        .expectOne(`${baseUrl}/rpc`)
        .flush({ jsonrpc: '2.0', id: 7, result: { id: 4, name: 'new-repo' } });
    });

    it('should surface JSON-RPC error responses with message or code fallback', () => {
      let err1: Error | undefined;
      service.rpcVersion().subscribe({
        error: (e: Error) => {
          err1 = e;
        },
      });
      httpMock.expectOne(`${baseUrl}/rpc`).flush({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32601, message: 'Method not found' },
      });
      expect(err1?.message).toBe('Method not found');

      let err2: Error | undefined;
      service.rpcVersion().subscribe({
        error: (e: Error) => {
          err2 = e;
        },
      });
      httpMock.expectOne(`${baseUrl}/rpc`).flush({
        jsonrpc: '2.0',
        id: 2,
        error: { code: -32603, message: '' },
      });
      expect(err2?.message).toBe('JSON-RPC error -32603');
    });

    it('should execute mcpInitialize, mcpListTools, mcpCallTool, and handle MCP errors', () => {
      service.mcpInitialize().subscribe((init) => {
        expect(init.serverInfo.name).toBe('cdd-gateway');
      });
      const m1 = httpMock.expectOne(`${baseUrl}/mcp/message`);
      expect(m1.request.body.method).toBe('initialize');
      m1.flush({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          serverInfo: { name: 'cdd-gateway', version: '0.1.0' },
        },
      });

      service.mcpListTools().subscribe((list) => {
        expect(list.tools.length).toBe(1);
      });
      httpMock.expectOne(`${baseUrl}/mcp/message`).flush({
        jsonrpc: '2.0',
        id: 2,
        result: { tools: [{ name: 'cdd-rust' }] },
      });

      service.mcpCallTool('cdd-rust', { target: 'to_sdk', spec: '{}' }).subscribe((res) => {
        expect(res.content[0].text).toBe('fn main() {}');
      });
      httpMock.expectOne(`${baseUrl}/mcp/message`).flush({
        jsonrpc: '2.0',
        id: 3,
        result: { content: [{ type: 'text', text: 'fn main() {}' }] },
      });

      service.mcpPing().subscribe((res) => {
        expect(res).toEqual({});
      });
      const mpReq = httpMock.expectOne(`${baseUrl}/mcp/message`);
      expect(mpReq.request.body.method).toBe('ping');
      mpReq.flush({ jsonrpc: '2.0', id: 4, result: {} });

      service
        .mcpGenerateSdk({ target_language: 'rust', input: '{}', output: '/tmp/out' })
        .subscribe((res) => {
          expect(res.content[0].text).toContain('rust');
        });
      const genReq1 = httpMock.expectOne(`${baseUrl}/mcp/message`);
      expect(genReq1.request.body.params).toEqual({
        name: 'cdd_generate_sdk',
        arguments: { target_language: 'rust', input: '{}', output: '/tmp/out' },
      });
      genReq1.flush({
        jsonrpc: '2.0',
        id: 5,
        result: { content: [{ type: 'text', text: 'generated rust' }] },
      });

      service.mcpGenerateSdk({ target_language: 'ts' }).subscribe((res) => {
        expect(res.content[0].text).toContain('ts');
      });
      const genReq2 = httpMock.expectOne(`${baseUrl}/mcp/message`);
      expect(genReq2.request.body.params).toEqual({
        name: 'cdd_generate_sdk',
        arguments: { target_language: 'ts' },
      });
      genReq2.flush({
        jsonrpc: '2.0',
        id: 6,
        result: { content: [{ type: 'text', text: 'generated ts' }] },
      });

      let mcpErr1: Error | undefined;
      service.mcpListTools().subscribe({
        error: (e: Error) => {
          mcpErr1 = e;
        },
      });
      httpMock.expectOne(`${baseUrl}/mcp/message`).flush({
        jsonrpc: '2.0',
        id: 4,
        error: { code: -32000, message: 'Engine unreachable' },
      });
      expect(mcpErr1?.message).toBe('Engine unreachable');

      let mcpErr2: Error | undefined;
      service.mcpListTools().subscribe({
        error: (e: Error) => {
          mcpErr2 = e;
        },
      });
      httpMock.expectOne(`${baseUrl}/mcp/message`).flush({
        jsonrpc: '2.0',
        id: 5,
        error: { code: -32001, message: '' },
      });
      expect(mcpErr2?.message).toBe('MCP error -32001');
    });
  });
});
