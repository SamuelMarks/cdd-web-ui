import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArtifactStorageService } from './artifact-storage.service';
import { BackendConfigService } from './backend-config.service';

describe('ArtifactStorageService', () => {
  let service: ArtifactStorageService;
  let httpMock: HttpTestingController;
  let config: BackendConfigService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ArtifactStorageService);
    httpMock = TestBed.inject(HttpTestingController);
    config = TestBed.inject(BackendConfigService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should throw when calling storage methods or getHostedDocsUrl while offline', () => {
    expect(() => service.uploadVersionArtifact('o', 'r', 'v1', 'data')).toThrowError(
      'Offline mode active. Cannot call Artifact Storage service.',
    );
    expect(() => service.getHostedDocsUrl('o', 'r', 'v1')).toThrowError(
      'Offline mode active. Cannot construct hosted docs URL.',
    );
  });

  describe('when online', () => {
    const baseUrl = 'http://localhost:8086';

    beforeEach(() => {
      config.setOnlineMode(baseUrl);
    });

    it('should uploadVersionArtifact and uploadFileArtifact with and without explicit token', () => {
      service
        .uploadVersionArtifact('acme', 'sdk', 'v1.0.0', 'binary-data', 'secret-key')
        .subscribe();
      const req1 = httpMock.expectOne(`${baseUrl}/storage/upload/acme/sdk/v1.0.0`);
      expect(req1.request.method).toBe('POST');
      expect(req1.request.headers.get('Authorization')).toBe('Bearer secret-key');
      req1.flush(null);

      service
        .uploadFileArtifact('acme', 'sdk', 'v1.0.0', '/docs.json', '{"openapi":"3.2.0"}')
        .subscribe();
      const req2 = httpMock.expectOne(`${baseUrl}/storage/upload/acme/sdk/v1.0.0/docs.json`);
      expect(req2.request.method).toBe('POST');
      expect(req2.request.headers.has('Authorization')).toBe(false);
      req2.flush(null);
    });

    it('should downloadArtifact with and without ETag and deleteArtifact', () => {
      const buf = new Uint8Array([1, 2, 3]).buffer;
      service.downloadArtifact('acme', 'sdk', '/v1.0.0/docs.json', '"etag-1"').subscribe((res) => {
        expect(res.body?.byteLength).toBe(3);
      });
      const req1 = httpMock.expectOne(`${baseUrl}/storage/artifact/acme/sdk/v1.0.0/docs.json`);
      expect(req1.request.method).toBe('GET');
      expect(req1.request.headers.get('If-None-Match')).toBe('"etag-1"');
      req1.flush(buf);

      service.downloadArtifact('acme', 'sdk', 'v1.0.0/docs.json').subscribe((res) => {
        expect(res.body?.byteLength).toBe(3);
      });
      const req2 = httpMock.expectOne(`${baseUrl}/storage/artifact/acme/sdk/v1.0.0/docs.json`);
      expect(req2.request.headers.has('If-None-Match')).toBe(false);
      req2.flush(buf);

      service.deleteArtifact('acme', 'sdk', '/v1.0.0/docs.json', 'secret-key').subscribe();
      const req3 = httpMock.expectOne(`${baseUrl}/storage/artifact/acme/sdk/v1.0.0/docs.json`);
      expect(req3.request.method).toBe('DELETE');
      expect(req3.request.headers.get('Authorization')).toBe('Bearer secret-key');
      req3.flush(null);
    });

    it('should construct hosted docs URL pointing to cdd-docs-ui and cdd-storage', () => {
      const url = service.getHostedDocsUrl('acme', 'sdk', 'v1.0.0');
      expect(url).toBe(
        'http://localhost:8086/docs/?spec=http%3A%2F%2Flocalhost%3A8086%2Fstorage%2Fartifact%2Facme%2Fsdk%2Fv1.0.0%2Fdocs.json',
      );
    });
  });
});
