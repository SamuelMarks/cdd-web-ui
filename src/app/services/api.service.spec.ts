import '@angular/compiler';
import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { BackendConfigService } from './backend-config.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  let config: BackendConfigService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
    config = TestBed.inject(BackendConfigService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should throw error if offline across url, controlPlaneUrl, and storageUrl helpers', () => {
    expect(() => service.getVersion()).toThrowError('Offline mode active. Cannot call API.');
    expect(() => service.listOrgs()).toThrowError('Offline mode active. Cannot call API.');
    expect(() => service.checkStorageHealth()).toThrowError(
      'Offline mode active. Cannot call API.',
    );
  });

  it('should allow probing health with explicit baseUrl even when offline', () => {
    service.checkGatewayHealth('http://localhost:8086/').subscribe((res) => {
      expect(res.status).toBe('ok');
    });
    const req1 = httpMock.expectOne('http://localhost:8086/health');
    expect(req1.request.method).toBe('GET');
    req1.flush({ status: 'ok' });

    service.checkControlPlaneHealth('http://localhost:8081/').subscribe((res) => {
      expect(res.status).toBe('ok');
    });
    const req2 = httpMock.expectOne('http://localhost:8081/api/v1/health');
    expect(req2.request.method).toBe('GET');
    req2.flush({ status: 'ok' });

    service.checkControlPlaneHealth('http://localhost:8081/api/v1/').subscribe((res) => {
      expect(res.status).toBe('ok');
    });
    const req3 = httpMock.expectOne('http://localhost:8081/api/v1/health');
    expect(req3.request.method).toBe('GET');
    req3.flush({ status: 'ok' });

    service.checkStorageHealth('http://localhost:8085/').subscribe((res) => {
      expect(res).toBe('OK');
    });
    const req4 = httpMock.expectOne('http://localhost:8085/health');
    expect(req4.request.method).toBe('GET');
    req4.flush('OK');
  });

  it('should format ping errors across Error instances, HTTP status 0, HTTP status codes, message objects, and unknown values', () => {
    expect(service.formatPingError('http://localhost:8086/health', new Error('Timeout'))).toBe(
      'GET http://localhost:8086/health -> Timeout',
    );
    expect(
      service.formatPingError('http://localhost:8086/health', {
        status: 0,
        statusText: '',
        error: 'ECONNREFUSED',
      }),
    ).toBe(
      'GET http://localhost:8086/health -> HTTP 0 (Unknown Error) - Network error, connection refused, or CORS blocked: ECONNREFUSED',
    );
    expect(
      service.formatPingError('http://localhost:8086/health', {
        status: 502,
        statusText: 'Bad Gateway',
        message: 'Upstream down',
      }),
    ).toBe('GET http://localhost:8086/health -> HTTP 502 (Bad Gateway): Upstream down');
    expect(
      service.formatPingError('http://localhost:8086/health', {
        status: 404,
        statusText: 'Not Found',
      }),
    ).toBe('GET http://localhost:8086/health -> HTTP 404 (Not Found)');
    expect(
      service.formatPingError('http://localhost:8086/health', {
        message: 'Custom error object',
      }),
    ).toBe('GET http://localhost:8086/health -> Custom error object');
    expect(service.formatPingError('http://localhost:8086/health', {})).toBe(
      'GET http://localhost:8086/health -> Unknown connection error',
    );
    expect(service.formatPingError('http://localhost:8086/health', 'raw string')).toBe(
      'GET http://localhost:8086/health -> Unknown connection error',
    );
  });

  it('should ping backend via gateway health, fallback to control plane health, and collect failure logs when both fail', () => {
    // 1. Direct gateway health success (with status and empty status fallback)
    service.pingBackend('http://localhost:8086/').subscribe((res) => {
      expect(res.status).toBe('ok');
      expect(res.endpoint).toBe('http://localhost:8086/health');
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    });
    httpMock.expectOne('http://localhost:8086/health').flush({ status: '' });

    // 2. Gateway health fails, Control Plane health succeeds (with empty status fallback)
    service.pingBackend('http://localhost:8081').subscribe((res) => {
      expect(res.status).toBe('ok');
      expect(res.endpoint).toBe('http://localhost:8081/api/v1/health');
    });
    httpMock
      .expectOne('http://localhost:8081/health')
      .flush('Not Found', { status: 404, statusText: 'Not Found' });
    httpMock.expectOne('http://localhost:8081/api/v1/health').flush({ status: '' });

    // 3. Both gateway and control plane health fail on distinct endpoints
    let capturedErr: { message: string; logs: string[] } | undefined;
    service.pingBackend('http://localhost:8086').subscribe({
      error: (err: { message: string; logs: string[] }) => {
        capturedErr = err;
      },
    });
    httpMock
      .expectOne('http://localhost:8086/health')
      .flush('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
    httpMock
      .expectOne('http://localhost:8086/api/v1/health')
      .flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    expect(capturedErr?.message).toContain('Ping failed for http://localhost:8086');
    expect(capturedErr?.logs.length).toBe(2);
    expect(capturedErr?.logs[0]).toContain('HTTP 503');
    expect(capturedErr?.logs[1]).toContain('HTTP 502');

    // 4. Base URL ending with /api/v1 deduplicates identical endpoint log line
    let capturedCpErr: { message: string; logs: string[] } | undefined;
    service.pingBackend('http://localhost:8081/api/v1').subscribe({
      error: (err: { message: string; logs: string[] }) => {
        capturedCpErr = err;
      },
    });
    httpMock
      .expectOne('http://localhost:8081/api/v1/health')
      .flush('Gateway Timeout', { status: 504, statusText: 'Gateway Timeout' });
    httpMock
      .expectOne('http://localhost:8081/api/v1/health')
      .flush('Gateway Timeout', { status: 504, statusText: 'Gateway Timeout' });
    expect(capturedCpErr?.logs.length).toBe(1);

    // 5. Using configured backendUrl when baseUrl param is omitted
    config.setOnlineMode('http://localhost:8086');
    service.pingBackend().subscribe((res) => {
      expect(res.status).toBe('healthy');
    });
    httpMock.expectOne('http://localhost:8086/health').flush({ status: 'healthy' });

    // 6. Calling pingBackend with empty baseUrl while offline
    config.setOfflineMode();
    expect(() => service.pingBackend('')).toThrowError('Offline mode active. Cannot call API.');
  });

  describe('when online', () => {
    const baseUrl = 'http://localhost:8080';

    beforeEach(() => {
      config.setOnlineMode(baseUrl);
    });

    it('should check gateway, control plane, and storage health using configured URLs', () => {
      service.checkGatewayHealth().subscribe((res) => {
        expect(res.status).toBe('ok');
      });
      httpMock.expectOne(`${baseUrl}/health`).flush({ status: 'ok' });

      service.checkControlPlaneHealth().subscribe((res) => {
        expect(res.status).toBe('ok');
      });
      httpMock.expectOne(`${baseUrl}/api/v1/health`).flush({ status: 'ok' });

      service.checkStorageHealth().subscribe((res) => {
        expect(res).toBe('OK');
      });
      httpMock.expectOne(`${baseUrl}/storage/health`).flush('OK');
    });

    it('should get version', () => {
      service.getVersion().subscribe((res) => {
        expect(res.version).toBe('1.0.0');
      });

      const req = httpMock.expectOne(`${baseUrl}/version`);
      expect(req.request.method).toBe('GET');
      req.flush({ version: '1.0.0' });
    });

    it('should register, login, loginGithub, and deleteAccount', () => {
      service.register({ username: 'u', email: 'e', password: 'p' }).subscribe((res) => {
        expect(res.token).toBe('t');
      });
      const regReq = httpMock.expectOne(`${baseUrl}/auth/register`);
      expect(regReq.request.method).toBe('POST');
      regReq.flush({ token: 't' });

      service.login({ username: 'u', password: 'p' }).subscribe((res) => {
        expect(res.token).toBe('t');
      });
      const loginReq = httpMock.expectOne(`${baseUrl}/auth/login`);
      expect(loginReq.request.method).toBe('POST');
      loginReq.flush({ token: 't' });

      service.loginGithub({ code: 'c' }).subscribe((res) => {
        expect(res.token).toBe('t');
      });
      const ghReq = httpMock.expectOne(`${baseUrl}/auth/github`);
      expect(ghReq.request.method).toBe('POST');
      ghReq.flush({ token: 't' });

      service.loginGoogle({ code: 'g-code' }).subscribe((res) => {
        expect(res.token).toBe('g-token');
      });
      const googleReq = httpMock.expectOne(`${baseUrl}/auth/google`);
      expect(googleReq.request.method).toBe('POST');
      googleReq.flush({ token: 'g-token' });

      service.getMe('mytoken').subscribe((profile) => {
        expect(profile.username).toBe('alice');
        expect(profile.github_linked).toBe(true);
      });
      const meReq = httpMock.expectOne(`${baseUrl}/api/v1/auth/me`);
      expect(meReq.request.method).toBe('GET');
      expect(meReq.request.headers.get('Authorization')).toBe('Bearer mytoken');
      meReq.flush({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        github_linked: true,
        google_linked: false,
        has_password: true,
      });

      service.connectGithub({ code: 'gh-link' }, 'mytoken').subscribe((profile) => {
        expect(profile.github_linked).toBe(true);
      });
      const connGhReq = httpMock.expectOne(`${baseUrl}/api/v1/auth/me/connect/github`);
      expect(connGhReq.request.method).toBe('POST');
      connGhReq.flush({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        github_linked: true,
        google_linked: false,
        has_password: true,
      });

      service.connectGoogle({ code: 'google-link' }, 'mytoken').subscribe((profile) => {
        expect(profile.google_linked).toBe(true);
      });
      const connGoogleReq = httpMock.expectOne(`${baseUrl}/api/v1/auth/me/connect/google`);
      expect(connGoogleReq.request.method).toBe('POST');
      connGoogleReq.flush({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        github_linked: true,
        google_linked: true,
        has_password: true,
      });

      service.connectPassword({ password: 'newpassword123' }, 'mytoken').subscribe((profile) => {
        expect(profile.has_password).toBe(true);
      });
      const connPwdReq = httpMock.expectOne(`${baseUrl}/api/v1/auth/me/connect/password`);
      expect(connPwdReq.request.method).toBe('POST');
      connPwdReq.flush({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        github_linked: true,
        google_linked: true,
        has_password: true,
      });

      service.disconnectProvider('google', 'mytoken').subscribe((profile) => {
        expect(profile.google_linked).toBe(false);
      });
      const discReq = httpMock.expectOne(`${baseUrl}/api/v1/auth/me/connect/google`);
      expect(discReq.request.method).toBe('DELETE');
      discReq.flush({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        github_linked: true,
        google_linked: false,
        has_password: true,
      });

      service.deleteAccount('mytoken').subscribe();
      const delReq = httpMock.expectOne(`${baseUrl}/api/v1/auth/me`);
      expect(delReq.request.method).toBe('DELETE');
      expect(delReq.request.headers.get('Authorization')).toBe('Bearer mytoken');
      delReq.flush(null);

      service
        .registerControlPlane({ username: 'u', email: 'e', password: 'p' })
        .subscribe((res) => {
          expect(res.token).toBe('cp-t');
        });
      const cpRegReq = httpMock.expectOne(`${baseUrl}/api/v1/auth/register`);
      expect(cpRegReq.request.method).toBe('POST');
      cpRegReq.flush({ token: 'cp-t' });

      service.loginControlPlane({ username: 'u', password: 'p' }).subscribe((res) => {
        expect(res.token).toBe('cp-t');
      });
      const cpLoginReq = httpMock.expectOne(`${baseUrl}/api/v1/auth/login`);
      expect(cpLoginReq.request.method).toBe('POST');
      cpLoginReq.flush({ token: 'cp-t' });
    });

    it('should listOrgs, getOrg, createOrg, createControlPlaneOrg, deleteOrg, and inviteOrgMember', () => {
      service.listOrgs().subscribe((orgs) => {
        expect(orgs.length).toBe(1);
      });
      const listReq = httpMock.expectOne(`${baseUrl}/api/v1/orgs`);
      expect(listReq.request.method).toBe('GET');
      expect(listReq.request.headers.has('Authorization')).toBe(false);
      listReq.flush([{ id: 1, login: 'org' }]);

      service.getOrg(1, 'mytoken').subscribe((org) => {
        expect(org.login).toBe('org');
      });
      const getReq = httpMock.expectOne(`${baseUrl}/api/v1/orgs/1`);
      expect(getReq.request.method).toBe('GET');
      expect(getReq.request.headers.get('Authorization')).toBe('Bearer mytoken');
      getReq.flush({ id: 1, login: 'org' });

      service.createOrg({ login: 'org' }, 'mytoken').subscribe((res) => {
        expect(res.login).toBe('org');
      });
      const createReq = httpMock.expectOne(`${baseUrl}/orgs`);
      expect(createReq.request.method).toBe('POST');
      expect(createReq.request.headers.get('Authorization')).toBe('Bearer mytoken');
      createReq.flush({ id: 1, login: 'org', userId: 1 });

      service.createControlPlaneOrg({ login: 'org-cp' }, 'mytoken').subscribe((res) => {
        expect(res.login).toBe('org-cp');
      });
      const createCpReq = httpMock.expectOne(`${baseUrl}/api/v1/orgs`);
      expect(createCpReq.request.method).toBe('POST');
      expect(createCpReq.request.headers.get('Authorization')).toBe('Bearer mytoken');
      createCpReq.flush({ id: 2, login: 'org-cp' });

      service.deleteOrg(1, 'mytoken').subscribe();
      const delReq = httpMock.expectOne(`${baseUrl}/api/v1/orgs/1`);
      expect(delReq.request.method).toBe('DELETE');
      delReq.flush(null);

      service.inviteOrgMember(1, { email: 'a@b.com', role: 'admin' }, 'mytoken').subscribe();
      const invReq = httpMock.expectOne(`${baseUrl}/api/v1/orgs/1/members`);
      expect(invReq.request.method).toBe('POST');
      expect(invReq.request.body).toEqual({ email: 'a@b.com', role: 'admin' });
      invReq.flush(null);
    });

    it('should listRepos, getRepo, createRepo, createOrgRepo, deleteRepo, listReleases, and createOrgRelease', () => {
      service.listRepos(1, 'mytoken').subscribe((repos) => {
        expect(repos.length).toBe(1);
      });
      httpMock.expectOne(`${baseUrl}/api/v1/orgs/1/repos`).flush([{ id: 10, name: 'r' }]);

      service.getRepo(1, 10).subscribe((repo) => {
        expect(repo.id).toBe(10);
      });
      httpMock.expectOne(`${baseUrl}/api/v1/orgs/1/repos/10`).flush({ id: 10, name: 'r' });

      service.createRepo({ organization_id: 1, name: 'repo' }, 'mytoken').subscribe((res) => {
        expect(res.name).toBe('repo');
      });
      const createReq = httpMock.expectOne(`${baseUrl}/repos`);
      expect(createReq.request.method).toBe('POST');
      expect(createReq.request.headers.get('Authorization')).toBe('Bearer mytoken');
      createReq.flush({ id: 1, name: 'repo', organizationId: 1 });

      service.createOrgRepo(1, { name: 'repo2', description: 'desc' }).subscribe((res) => {
        expect(res.name).toBe('repo2');
      });
      const createOrgRepoReq = httpMock.expectOne(`${baseUrl}/api/v1/orgs/1/repos`);
      expect(createOrgRepoReq.request.method).toBe('POST');
      createOrgRepoReq.flush({ id: 2, organization_id: 1, name: 'repo2' });

      service
        .updateOrgRepo(1, 2, {
          name: 'repo2-updated',
          topology_mode: 'monorepo',
          languages: ['rust', 'typescript'],
        })
        .subscribe((res) => {
          expect(res.name).toBe('repo2-updated');
        });
      const updateRepoReq = httpMock.expectOne(`${baseUrl}/api/v1/orgs/1/repos/2`);
      expect(updateRepoReq.request.method).toBe('PATCH');
      updateRepoReq.flush({ id: 2, organization_id: 1, name: 'repo2-updated' });

      service.listGithubOrgs('mytoken').subscribe((orgs) => {
        expect(orgs.length).toBe(1);
        expect(orgs[0].login).toBe('offscale');
      });
      const ghOrgsReq = httpMock.expectOne(`${baseUrl}/github/orgs`);
      expect(ghOrgsReq.request.method).toBe('GET');
      ghOrgsReq.flush([{ id: 100, login: 'offscale' }]);

      service
        .provisionGithubRepos(
          {
            github_org_name: 'offscale',
            topology_mode: 'monorepo',
            monorepo_name: 'offscale-sdk',
            languages: ['rust', 'typescript'],
          },
          'mytoken',
        )
        .subscribe((repos) => {
          expect(repos.length).toBe(1);
          expect(repos[0].name).toBe('offscale-sdk');
        });
      const provReq = httpMock.expectOne(`${baseUrl}/github/provision`);
      expect(provReq.request.method).toBe('POST');
      provReq.flush([{ id: 99, name: 'offscale-sdk' }]);

      service.deleteRepo(1, 2).subscribe();
      const delRepoReq = httpMock.expectOne(`${baseUrl}/api/v1/orgs/1/repos/2`);
      expect(delRepoReq.request.method).toBe('DELETE');
      delRepoReq.flush(null);

      service.listReleases(1, 2).subscribe((releases) => {
        expect(releases.length).toBe(1);
      });
      httpMock
        .expectOne(`${baseUrl}/api/v1/orgs/1/repos/2/releases`)
        .flush([{ id: 5, repository_id: 2, tag_name: 'v1.0.0' }]);

      service.createOrgRelease(1, 2, { tag_name: 'v1.0.0', name: 'Release 1' }).subscribe((rel) => {
        expect(rel.tag_name).toBe('v1.0.0');
      });
      const relReq = httpMock.expectOne(`${baseUrl}/api/v1/orgs/1/repos/2/releases`);
      expect(relReq.request.method).toBe('POST');
      relReq.flush({ id: 5, repository_id: 2, tag_name: 'v1.0.0' });
    });

    it('should listTokens, storeToken, and deleteToken', () => {
      service.listTokens('mytoken').subscribe((tokens) => {
        expect(tokens).toEqual(['npm', 'pypi']);
      });
      httpMock.expectOne(`${baseUrl}/api/v1/tokens`).flush(['npm', 'pypi']);

      service.storeToken({ provider: 'npm', token: 'npm_123' }).subscribe((res) => {
        expect(res.status).toBe('ok');
      });
      const storeReq = httpMock.expectOne(`${baseUrl}/api/v1/tokens`);
      expect(storeReq.request.method).toBe('POST');
      expect(storeReq.request.body).toEqual({ provider: 'npm', token: 'npm_123' });
      storeReq.flush({ status: 'ok' });

      service.deleteToken('npm').subscribe();
      const delReq = httpMock.expectOne(`${baseUrl}/api/v1/tokens/npm`);
      expect(delReq.request.method).toBe('DELETE');
      delReq.flush(null);
    });

    it('should listAuditLogs with and without pagination query params', () => {
      service.listAuditLogs(1).subscribe((logs) => {
        expect(logs.length).toBe(0);
      });
      const req1 = httpMock.expectOne(`${baseUrl}/api/v1/orgs/1/audit`);
      expect(req1.request.method).toBe('GET');
      req1.flush([]);

      service.listAuditLogs(1, { limit: 25, offset: 50 }, 'mytoken').subscribe((logs) => {
        expect(logs.length).toBe(1);
      });
      const req2 = httpMock.expectOne(`${baseUrl}/api/v1/orgs/1/audit?limit=25&offset=50`);
      expect(req2.request.method).toBe('GET');
      expect(req2.request.headers.get('Authorization')).toBe('Bearer mytoken');
      req2.flush([
        {
          id: 1,
          org_id: 1,
          repo_id: null,
          user_id: 1,
          action: 'org_created',
          metadata_json: null,
          timestamp: '2026-10-31T00:00:00Z',
        },
      ]);
    });

    it('should syncGithub, createRelease, createGithubRelease, triggerAction, triggerGithubWorkflow, createSecret, and createGithubSecret', () => {
      service.syncGithub('mytoken').subscribe((res) => expect(res.success).toBe(true));
      const syncReq = httpMock.expectOne(`${baseUrl}/github/sync`);
      expect(syncReq.request.method).toBe('POST');
      syncReq.flush({ success: true, message: 'Synced' });

      service
        .createRelease({ repository_id: 1, tag_name: 'v1' }, 'mytoken')
        .subscribe((res) => expect(res).toBeTruthy());
      const relReq = httpMock.expectOne(`${baseUrl}/github/releases`);
      expect(relReq.request.method).toBe('POST');
      relReq.flush({});

      service
        .createGithubRelease({ owner: 'o', repo: 'r', tag_name: 'v1.0.0' })
        .subscribe((res) => expect(res).toBeTruthy());
      const ghRelReq = httpMock.expectOne(`${baseUrl}/github/releases`);
      expect(ghRelReq.request.method).toBe('POST');
      ghRelReq.flush({});

      service
        .triggerAction({ ref: 'main' }, 'mytoken')
        .subscribe((res) => expect(res).toBeTruthy());
      const trigReq = httpMock.expectOne(`${baseUrl}/github/actions/workflows/trigger`);
      expect(trigReq.request.method).toBe('POST');
      trigReq.flush({});

      service
        .triggerGithubWorkflow({
          owner: 'o',
          repo: 'r',
          workflow_id: 'ci.yml',
          ref_branch: 'main',
        })
        .subscribe((res) => expect(res).toBeTruthy());
      const ghTrigReq = httpMock.expectOne(`${baseUrl}/github/actions/workflows/trigger`);
      expect(ghTrigReq.request.method).toBe('POST');
      ghTrigReq.flush({});

      service
        .createSecret({ repository_id: 1, secret_name: 'A', secret_value: 'B' }, 'mytoken')
        .subscribe((res) => expect(res).toBeTruthy());
      const secReq = httpMock.expectOne(`${baseUrl}/github/actions/secrets`);
      expect(secReq.request.method).toBe('POST');
      secReq.flush({});

      service
        .createGithubSecret({
          owner: 'o',
          repo: 'r',
          secret_name: 'NPM_TOKEN',
          secret_value: 'val',
        })
        .subscribe((res) => expect(res).toBeTruthy());
      const ghSecReq = httpMock.expectOne(`${baseUrl}/github/actions/secrets`);
      expect(ghSecReq.request.method).toBe('POST');
      ghSecReq.flush({});

      service
        .dispatchGithubWorkflow(
          {
            owner: 'o',
            repo: 'r',
            workflow_id: 'ci.yml',
            ref_branch: 'main',
          },
          'mytoken',
        )
        .subscribe();
      const dispReq = httpMock.expectOne(`${baseUrl}/github/actions/dispatch`);
      expect(dispReq.request.method).toBe('POST');
      expect(dispReq.request.headers.get('Authorization')).toBe('Bearer mytoken');
      dispReq.flush(null);

      service
        .storeGithubSecret(
          {
            owner: 'o',
            repo: 'r',
            secret_name: 'NPM_TOKEN',
            secret_value: 'val',
          },
          'mytoken',
        )
        .subscribe();
      const storeSecReq = httpMock.expectOne(`${baseUrl}/github/secrets`);
      expect(storeSecReq.request.method).toBe('POST');
      expect(storeSecReq.request.headers.get('Authorization')).toBe('Bearer mytoken');
      storeSecReq.flush(null);

      service.sendGithubWebhook('{"action":"published"}', 'sha256=deadbeef').subscribe((res) => {
        expect(res.success).toBe(true);
      });
      const whReq = httpMock.expectOne(`${baseUrl}/github/webhook`);
      expect(whReq.request.method).toBe('POST');
      expect(whReq.request.headers.get('x-hub-signature-256')).toBe('sha256=deadbeef');
      whReq.flush({ success: true });

      service
        .reportPublishAudit(
          {
            artifact_id: 'art-1',
            registry: 'npm',
            success: true,
            error_message: null,
          },
          'mytoken',
        )
        .subscribe();
      const pubAuditReq = httpMock.expectOne(`${baseUrl}/api/v1/audit/publish`);
      expect(pubAuditReq.request.method).toBe('POST');
      expect(pubAuditReq.request.headers.get('Authorization')).toBe('Bearer mytoken');
      pubAuditReq.flush(null);
    });
  });
});
