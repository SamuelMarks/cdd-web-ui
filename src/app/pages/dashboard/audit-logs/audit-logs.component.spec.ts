import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuditLogsComponent } from './audit-logs.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ApiService } from '../../../services/api.service';
import { BackendConfigService } from '../../../services/backend-config.service';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('AuditLogsComponent', () => {
  let component: AuditLogsComponent;
  let fixture: ComponentFixture<AuditLogsComponent>;
  let mockApi: {
    listOrgs: ReturnType<typeof vi.fn>;
    listAuditLogs: ReturnType<typeof vi.fn>;
  };
  let mockConfig: {
    isOnline: ReturnType<typeof signal<boolean>>;
  };

  beforeEach(async () => {
    mockApi = {
      listOrgs: vi.fn(),
      listAuditLogs: vi.fn(),
    };
    mockConfig = {
      isOnline: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [AuditLogsComponent, HttpClientTestingModule],
      providers: [
        { provide: ApiService, useValue: mockApi },
        { provide: BackendConfigService, useValue: mockConfig },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should handle viewError, closeError, pagination, and orgChange in offline mode', () => {
    const mockEvent = component.logs()[0];
    component.viewError(mockEvent);
    expect(component.selectedEventError()).toEqual(mockEvent);

    component.closeError();
    expect(component.selectedEventError()).toBeNull();

    component.nextPage();
    expect(component.offset()).toBe(25);
    component.prevPage();
    expect(component.offset()).toBe(0);

    component.onOrgChange({ target: { value: '2' } } as unknown as Event);
    expect(component.selectedOrgId()).toBe(2);

    component.onOrgChange({ target: { value: '' } } as unknown as Event);
    expect(component.selectedOrgId()).toBe(1);
  });

  describe('when online', () => {
    beforeEach(() => {
      mockConfig.isOnline.set(true);
    });

    it('should load organizations and audit logs on ngOnInit and map records accurately', () => {
      mockApi.listOrgs.mockReturnValue(
        of([
          { id: 10, login: 'acme' },
          { id: 20, login: 'beta', name: 'Beta' },
        ]),
      );
      mockApi.listAuditLogs.mockReturnValue(
        of([
          {
            id: 1,
            org_id: 10,
            repo_id: 5,
            user_id: 1,
            action: 'release_created',
            metadata_json: {
              repository: 'acme/api',
              language: 'Rust',
              durationMs: 2500,
            },
            timestamp: '2026-10-31T00:00:00Z',
          },
          {
            id: 2,
            org_id: 10,
            repo_id: 5,
            user_id: 1,
            action: 'sdk_generated',
            metadata_json: {
              error: 'Compile error',
            },
            timestamp: '2026-10-31T00:01:00Z',
          },
          {
            id: 3,
            org_id: 10,
            repo_id: null,
            user_id: 1,
            action: 'org_created',
            metadata_json: null,
            timestamp: '2026-10-31T00:02:00Z',
          },
          {
            id: 4,
            org_id: 10,
            repo_id: 5,
            user_id: 1,
            action: 'publish_failed',
            metadata_json: {
              error_message: 'Registry token expired',
            },
            timestamp: '2026-10-31T00:03:00Z',
          },
        ]),
      );

      component.ngOnInit();
      expect(component.selectedOrgId()).toBe(10);
      expect(component.logs().length).toBe(4);
      expect(component.logs()[0].action).toBe('Publishing');
      expect(component.logs()[0].repository).toBe('acme/api');
      expect(component.logs()[1].status).toBe('Failed');
      expect(component.logs()[1].repository).toBe('repo-5');
      expect(component.logs()[2].repository).toBe('org-10');
      expect(component.logs()[3].status).toBe('Failed');
      expect(component.logs()[3].errorMessage).toBe('Registry token expired');

      // Empty orgs list and listOrgs error fallback
      mockApi.listOrgs.mockReturnValue(of([]));
      component.loadOrganizationsAndLogs();

      mockApi.listOrgs.mockReturnValue(throwError(() => new Error('Org err')));
      component.loadOrganizationsAndLogs();

      // listAuditLogs error branch
      mockApi.listAuditLogs.mockReturnValue(throwError(() => new Error('Audit err')));
      component.refreshLogs();
      expect(component.errorMessage()).toBe('Failed to load audit logs from backend.');
    });
  });
});
