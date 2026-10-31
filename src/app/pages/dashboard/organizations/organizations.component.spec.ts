import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrganizationsComponent } from './organizations.component';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ApiService } from '../../../services/api.service';
import { BackendConfigService } from '../../../services/backend-config.service';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('OrganizationsComponent', () => {
  let component: OrganizationsComponent;
  let fixture: ComponentFixture<OrganizationsComponent>;
  let mockApi: {
    listOrgs: ReturnType<typeof vi.fn>;
    createOrg: ReturnType<typeof vi.fn>;
    deleteOrg: ReturnType<typeof vi.fn>;
    syncGithub: ReturnType<typeof vi.fn>;
    inviteOrgMember: ReturnType<typeof vi.fn>;
  };
  let mockConfig: {
    isOnline: ReturnType<typeof signal<boolean>>;
  };

  beforeEach(async () => {
    mockApi = {
      listOrgs: vi.fn(),
      createOrg: vi.fn(),
      deleteOrg: vi.fn(),
      syncGithub: vi.fn(),
      inviteOrgMember: vi.fn(),
    };
    mockConfig = {
      isOnline: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [OrganizationsComponent, ReactiveFormsModule, HttpClientTestingModule],
      providers: [
        { provide: ApiService, useValue: mockApi },
        { provide: BackendConfigService, useValue: mockConfig },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle create form', () => {
    expect(component.showCreateForm()).toBe(false);
    component.toggleCreateForm();
    expect(component.showCreateForm()).toBe(true);

    component.createOrgForm.controls.name.setValue('test');
    component.toggleCreateForm();
    expect(component.showCreateForm()).toBe(false);
    expect(component.createOrgForm.value.name).toBeNull();
  });

  it('should create organization when form is valid in offline mode', () => {
    const initialCount = component.organizations().length;
    component.createOrgForm.controls.name.setValue('New Org');

    component.onCreateOrg();

    expect(component.organizations().length).toBe(initialCount + 1);
    expect(component.organizations()[initialCount].name).toBe('New Org');
  });

  it('should handle onCreateOrg when form name is falsy', () => {
    component.createOrgForm.controls.name.clearValidators();
    component.createOrgForm.controls.name.setValue(null);
    const initialCount = component.organizations().length;
    component.onCreateOrg();
    expect(component.organizations().length).toBe(initialCount + 1);
    expect(component.organizations()[initialCount].name).toBe('');
  });

  it('should not create organization when form is invalid', () => {
    const initialCount = component.organizations().length;
    component.createOrgForm.controls.name.setValue('');

    component.onCreateOrg();

    expect(component.organizations().length).toBe(initialCount);
  });

  it('should handle invite process in offline mode', () => {
    const org = component.organizations()[0];
    const initialMembers = org.members;

    component.openInvite(org);
    expect(component.selectedOrgForInvite()).toEqual(org);

    component.inviteForm.controls.email.setValue('invalid');
    component.onInvite();
    expect(component.organizations()[0].members).toBe(initialMembers);

    component.inviteForm.controls.email.setValue('test@test.com');
    component.inviteForm.controls.role.setValue('Admin');

    component.onInvite();

    expect(component.organizations()[0].members).toBe(initialMembers + 1);
    expect(component.selectedOrgForInvite()).toBeNull();
  });

  it('should close invite modal', () => {
    const org = component.organizations()[0];
    component.openInvite(org);
    component.closeInvite();
    expect(component.selectedOrgForInvite()).toBeNull();
  });

  it('should handle onInvite when selectedOrgForInvite is null', () => {
    component.inviteForm.setValue({ email: 'test@test.com', role: 'Member' });
    component.selectedOrgForInvite.set(null);
    component.onInvite();
    expect(component.selectedOrgForInvite()).toBeNull();
  });

  it('should delete organization in offline mode and handle syncGithub when offline', () => {
    const org = component.organizations()[0];
    component.onDeleteOrg(org);
    expect(component.organizations().find((o) => o.id === org.id)).toBeUndefined();

    component.onSyncGithub();
    expect(component.statusMessage()).toBe('GitHub synchronization requires Online Mode.');
  });

  describe('when online', () => {
    beforeEach(() => {
      mockConfig.isOnline.set(true);
    });

    it('should load organizations on ngOnInit with role mapping and handle error', () => {
      mockApi.listOrgs.mockReturnValue(
        of([
          { id: 1, login: 'acme', role: 'owner', members: 3 },
          { id: 2, login: 'beta', name: 'Beta Org', role: 'admin' },
          { id: 3, login: 'gamma', role: 'member' },
        ]),
      );
      component.ngOnInit();
      expect(component.organizations()).toEqual([
        { id: '1', name: 'acme', role: 'Owner', members: 3 },
        { id: '2', name: 'Beta Org', role: 'Admin', members: 1 },
        { id: '3', name: 'gamma', role: 'Member', members: 1 },
      ]);

      mockApi.listOrgs.mockReturnValue(throwError(() => new Error('Network error')));
      component.loadOrganizations();
      expect(component.errorMessage()).toBe('Failed to load organizations from backend.');
    });

    it('should create organization via ApiService when online and handle error', () => {
      mockApi.createOrg.mockReturnValue(of({ id: 99, login: 'online-org' }));
      component.showCreateForm.set(true);
      component.createOrgForm.controls.name.setValue('online-org');
      component.onCreateOrg();
      expect(mockApi.createOrg).toHaveBeenCalledWith({ login: 'online-org' });
      expect(component.organizations().some((o) => o.name === 'online-org')).toBe(true);

      mockApi.createOrg.mockReturnValue(throwError(() => new Error('Conflict')));
      component.showCreateForm.set(true);
      component.createOrgForm.controls.name.setValue('dup-org');
      component.onCreateOrg();
      expect(component.errorMessage()).toBe('Failed to create organization on backend.');
    });

    it('should delete organization via ApiService when online and handle error', () => {
      const org = component.organizations()[0];
      mockApi.deleteOrg.mockReturnValue(of(undefined));
      component.onDeleteOrg(org);
      expect(mockApi.deleteOrg).toHaveBeenCalledWith(org.id);
      expect(component.statusMessage()).toContain('Deleted organization');

      const org2 = component.organizations()[0];
      mockApi.deleteOrg.mockReturnValue(throwError(() => new Error('Fail')));
      component.onDeleteOrg(org2);
      expect(component.errorMessage()).toContain('Failed to delete organization');
    });

    it('should syncGithub via ApiService when online and handle error', () => {
      mockApi.syncGithub.mockReturnValue(of({ success: true, message: '' }));
      mockApi.listOrgs.mockReturnValue(of([]));
      component.onSyncGithub();
      expect(mockApi.syncGithub).toHaveBeenCalled();
      expect(component.statusMessage()).toBe('Synchronized with GitHub.');

      mockApi.syncGithub.mockReturnValue(throwError(() => new Error('Sync err')));
      component.onSyncGithub();
      expect(component.errorMessage()).toBe('Failed to synchronize with GitHub.');
    });

    it('should invite organization member via ApiService when online and handle error', () => {
      const org = component.organizations()[0];
      component.openInvite(org);
      component.inviteForm.controls.email.setValue('invitee@example.com');
      component.inviteForm.controls.role.setValue('Admin');

      mockApi.inviteOrgMember.mockReturnValue(of(undefined));
      component.onInvite();
      expect(mockApi.inviteOrgMember).toHaveBeenCalledWith(org.id, {
        email: 'invitee@example.com',
        role: 'admin',
      });

      // Also test error branch and falsy email/role fallback
      component.openInvite(org);
      component.inviteForm.controls.email.clearValidators();
      component.inviteForm.controls.role.clearValidators();
      component.inviteForm.setValue({ email: null, role: null });
      mockApi.inviteOrgMember.mockReturnValue(throwError(() => new Error('Invite err')));
      component.onInvite();
      expect(component.errorMessage()).toBe('Failed to send organization invitation.');
    });
  });
});
