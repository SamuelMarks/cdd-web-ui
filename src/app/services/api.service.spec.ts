import '@angular/compiler';
import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { BackendConfigService } from './backend-config.service';
import { Organization, Repository, User } from '../models/types';

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

  it('should throw error if offline', () => {
    expect(() => service.getVersion()).toThrowError('Offline mode active. Cannot call API.');
  });

  describe('when online', () => {
    const baseUrl = 'http://localhost:8080';

    beforeEach(() => {
      config.setOnlineMode(baseUrl);
    });

    it('should get version', () => {
      service.getVersion().subscribe((res) => {
        expect(res.version).toBe('1.0.0');
      });

      const req = httpMock.expectOne(`${baseUrl}/version`);
      expect(req.request.method).toBe('GET');
      req.flush({ version: '1.0.0' });
    });

    it('should register', () => {
      service.register({ username: 'u', email: 'e', password: 'p' }).subscribe((res) => {
        expect(res.token).toBe('t');
      });

      const req = httpMock.expectOne(`${baseUrl}/auth/register`);
      expect(req.request.method).toBe('POST');
      req.flush({ token: 't' });
    });

    it('should login', () => {
      service.login({ username: 'u', password: 'p' }).subscribe((res) => {
        expect(res.token).toBe('t');
      });

      const req = httpMock.expectOne(`${baseUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      req.flush({ token: 't' });
    });

    it('should loginGithub', () => {
      service.loginGithub({ code: 'c' }).subscribe((res) => {
        expect(res.token).toBe('t');
      });

      const req = httpMock.expectOne(`${baseUrl}/auth/github`);
      expect(req.request.method).toBe('POST');
      req.flush({ token: 't' });
    });

    it('should createOrg', () => {
      service.createOrg({ login: 'org' }, 'mytoken').subscribe((res) => {
        expect(res.login).toBe('org');
      });

      const req = httpMock.expectOne(`${baseUrl}/orgs`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe('Bearer mytoken');
      req.flush({ id: 1, login: 'org', userId: 1 } as Organization);
    });

    it('should createRepo', () => {
      service.createRepo({ organization_id: 1, name: 'repo' }, 'mytoken').subscribe((res) => {
        expect(res.name).toBe('repo');
      });

      const req = httpMock.expectOne(`${baseUrl}/repos`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe('Bearer mytoken');
      req.flush({ id: 1, name: 'repo', organizationId: 1 } as Repository);
    });

    it('should syncGithub', () => {
      service.syncGithub('mytoken').subscribe((res) => expect(res).toBeTruthy());
      const req = httpMock.expectOne(`${baseUrl}/github/sync`);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });

    it('should createRelease', () => {
      service
        .createRelease({ repository_id: 1, tag_name: 'v1' }, 'mytoken')
        .subscribe((res) => expect(res).toBeTruthy());
      const req = httpMock.expectOne(`${baseUrl}/github/releases`);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });

    it('should triggerAction', () => {
      service
        .triggerAction({ ref: 'main' }, 'mytoken')
        .subscribe((res) => expect(res).toBeTruthy());
      const req = httpMock.expectOne(`${baseUrl}/github/actions/workflows/trigger`);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });

    it('should createSecret', () => {
      service
        .createSecret({ repository_id: 1, secret_name: 'A', secret_value: 'B' }, 'mytoken')
        .subscribe((res) => expect(res).toBeTruthy());
      const req = httpMock.expectOne(`${baseUrl}/github/actions/secrets`);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });
  });
});
