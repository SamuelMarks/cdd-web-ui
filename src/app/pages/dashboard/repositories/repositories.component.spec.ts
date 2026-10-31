import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RepositoriesComponent } from './repositories.component';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ApiService } from '../../../services/api.service';
import { BackendConfigService } from '../../../services/backend-config.service';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as WorkspaceActions from '../../../store/actions';

describe('RepositoriesComponent', () => {
  let component: RepositoriesComponent;
  let fixture: ComponentFixture<RepositoriesComponent>;
  let mockApi: {
    listOrgs: ReturnType<typeof vi.fn>;
    listRepos: ReturnType<typeof vi.fn>;
    createOrgRepo: ReturnType<typeof vi.fn>;
    deleteRepo: ReturnType<typeof vi.fn>;
    listReleases: ReturnType<typeof vi.fn>;
    createOrgRelease: ReturnType<typeof vi.fn>;
  };
  let mockConfig: {
    isOnline: ReturnType<typeof signal<boolean>>;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let store: MockStore;

  beforeEach(async () => {
    mockApi = {
      listOrgs: vi.fn(),
      listRepos: vi.fn(),
      createOrgRepo: vi.fn(),
      deleteRepo: vi.fn(),
      listReleases: vi.fn(),
      createOrgRelease: vi.fn(),
    };
    mockConfig = {
      isOnline: signal(false),
    };
    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RepositoriesComponent, ReactiveFormsModule, HttpClientTestingModule],
      providers: [
        provideMockStore(),
        { provide: ApiService, useValue: mockApi },
        { provide: BackendConfigService, useValue: mockConfig },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(RepositoriesComponent);
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

    component.createRepoForm.controls.name.setValue('test');
    component.toggleCreateForm();
    expect(component.showCreateForm()).toBe(false);
    expect(component.createRepoForm.value.name).toBeNull();
  });

  it('should create repo when form is valid in offline mode', () => {
    const initialCount = component.repositories().length;
    component.createRepoForm.controls.name.setValue('new/repo');
    component.createRepoForm.controls.organization.setValue('Offscale');

    component.onCreateRepo();

    expect(component.repositories().length).toBe(initialCount + 1);
    expect(component.repositories()[initialCount].name).toBe('new/repo');
  });

  it('should handle onCreateRepo when form values are falsy or org not in availableOrgs', () => {
    component.createRepoForm.controls.name.clearValidators();
    component.createRepoForm.controls.organization.clearValidators();
    component.createRepoForm.setValue({ name: null, organization: 'UnknownOrg' });

    const initialCount = component.repositories().length;
    component.onCreateRepo();

    expect(component.repositories().length).toBe(initialCount + 1);
    expect(component.repositories()[initialCount].name).toBe('');
    expect(component.repositories()[initialCount].organization).toBe('UnknownOrg');

    component.createRepoForm.setValue({ name: null, organization: null });
    component.onCreateRepo();
    expect(component.repositories()[initialCount + 1].organization).toBe('Offscale');
  });

  it('should not create repo when form is invalid', () => {
    const initialCount = component.repositories().length;
    component.createRepoForm.controls.name.setValue('');

    component.onCreateRepo();

    expect(component.repositories().length).toBe(initialCount);
  });

  it('should handle schema config', () => {
    const repo = component.repositories()[0];
    component.openSchemaConfig(repo);
    expect(component.selectedRepoForSchema()).toEqual(repo);

    component.schemaForm.controls.schemaUrl.setValue('http://new-schema');
    component.onSaveSchema();

    expect(component.repositories()[0].schemaUrl).toBe('http://new-schema');
    expect(component.selectedRepoForSchema()).toBeNull();
  });

  it('should handle schema config when repo has no schemaUrl and schemaForm has falsy url', () => {
    const repo = component.repositories()[0];
    const repoWithoutSchema = { ...repo, schemaUrl: undefined };

    component.openSchemaConfig(repoWithoutSchema);
    expect(component.schemaForm.value.schemaUrl).toBe('');

    component.schemaForm.controls.schemaUrl.clearValidators();
    component.schemaForm.controls.schemaUrl.setValue(null);
    component.onSaveSchema();

    expect(component.repositories()[0].schemaUrl).toBe('');
  });

  it('should handle schema config when selectedRepoForSchema is null', () => {
    component.schemaForm.controls.schemaUrl.setValue('http://new-schema');
    component.selectedRepoForSchema.set(null);
    component.onSaveSchema();
    expect(component.selectedRepoForSchema()).toBeNull();
  });

  it('should not save schema config if invalid', () => {
    const repo = component.repositories()[0];
    const origUrl = repo.schemaUrl;
    component.openSchemaConfig(repo);

    component.schemaForm.controls.schemaUrl.setValue('');
    component.onSaveSchema();

    expect(component.repositories()[0].schemaUrl).toBe(origUrl);
  });

  it('should close schema config', () => {
    const repo = component.repositories()[0];
    component.openSchemaConfig(repo);
    component.closeSchemaConfig();
    expect(component.selectedRepoForSchema()).toBeNull();
  });

  it('should handle language config open/close', () => {
    const repo = component.repositories()[0];
    component.openLangConfig(repo);
    expect(component.selectedRepoForLang()).toEqual(repo);

    component.closeLangConfig();
    expect(component.selectedRepoForLang()).toBeNull();
  });

  it('should toggle language', () => {
    const repo = component.repositories()[0];
    component.openLangConfig(repo);

    expect(component.isLangSelected('TypeScript')).toBe(true);
    expect(component.isLangSelected('Go')).toBe(false);

    component.toggleLang('Go');
    expect(component.repositories()[0].languages).toContain('Go');
    expect(component.isLangSelected('Go')).toBe(true);

    component.toggleLang('TypeScript');
    expect(component.repositories()[0].languages).not.toContain('TypeScript');
    expect(component.isLangSelected('TypeScript')).toBe(false);
  });

  it('should safely handle toggleLang when no repo selected', () => {
    component.selectedRepoForLang.set(null);
    expect(() => component.toggleLang('Go')).not.toThrow();
  });

  it('should return false for isLangSelected when no repo selected', () => {
    component.selectedRepoForLang.set(null);
    expect(component.isLangSelected('Go')).toBe(false);
  });

  it('should delete repo, open in workspace, and create release in offline mode', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    const repo = component.repositories()[0];
    component.openInWorkspace(repo);
    expect(dispatchSpy).toHaveBeenCalledWith(
      WorkspaceActions.addOpenApiUrl({
        url: repo.schemaUrl,
      }),
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);

    // Repo without schemaUrl does not dispatch
    dispatchSpy.mockClear();
    component.openInWorkspace({ ...repo, schemaUrl: undefined });
    expect(dispatchSpy).not.toHaveBeenCalled();

    // Release modal in offline mode
    component.openReleaseModal(repo);
    expect(component.selectedRepoForRelease()).toEqual(repo);
    component.releaseForm.setValue({ tag_name: 'v1.2.0', name: 'Rel', body: 'Notes' });
    component.onCreateRelease();
    expect(component.repoReleases()[repo.id].length).toBe(1);

    // Second release with falsy name/body and non-numeric id
    component.openReleaseModal(repo);
    component.releaseForm.controls.tag_name.clearValidators();
    component.releaseForm.setValue({ tag_name: null, name: null, body: null });
    component.onCreateRelease();
    expect(component.repoReleases()[repo.id].length).toBe(2);

    // Invalid releaseForm does nothing
    component.releaseForm.controls.tag_name.setErrors({ required: true });
    component.onCreateRelease();

    // Null selectedRepoForRelease branch
    component.selectedRepoForRelease.set(null);
    component.releaseForm.setValue({ tag_name: 'v1.3.0', name: '', body: '' });
    component.onCreateRelease();

    // Delete repo in offline mode
    component.onDeleteRepo({ ...repo, organizationId: undefined });
    expect(component.repositories().find((r) => r.id === repo.id)).toBeUndefined();
  });

  describe('when online', () => {
    beforeEach(() => {
      mockConfig.isOnline.set(true);
    });

    it('should load remote organizations and repositories on ngOnInit and handle errors', () => {
      mockApi.listOrgs.mockReturnValue(
        of([
          { id: 10, login: 'acme' },
          { id: 20, login: 'beta', name: 'Beta' },
        ]),
      );
      mockApi.listRepos.mockImplementation((orgId: number) =>
        orgId === 10
          ? of([{ id: 100, name: 'sdk-core', specUrl: 'https://example.com/spec.yaml' }])
          : of([
              {
                id: 200,
                name: 'sdk-web',
                schemaUrl: 'https://example.com/web.json',
                languages: ['Go'],
              },
            ]),
      );

      component.ngOnInit();
      expect(component.availableOrgs().length).toBe(2);
      expect(component.repositories().length).toBe(2);

      // Empty orgs list branch
      mockApi.listOrgs.mockReturnValue(of([]));
      component.loadRemoteRepositories();

      // Repo list error branch
      mockApi.listOrgs.mockReturnValue(of([{ id: 10, login: 'acme' }]));
      mockApi.listRepos.mockReturnValue(throwError(() => new Error('Repo error')));
      component.loadRemoteRepositories();
      expect(component.errorMessage()).toContain('Failed to load repositories for acme');

      // Org list error branch
      mockApi.listOrgs.mockReturnValue(throwError(() => new Error('Org error')));
      component.loadRemoteRepositories();
      expect(component.errorMessage()).toBe('Failed to load organizations from backend.');
    });

    it('should create and delete repository via ApiService when online', () => {
      mockApi.createOrgRepo.mockReturnValue(
        of({ id: 300, name: 'new-online-repo', languages: ['Rust'] }),
      );
      component.showCreateForm.set(true);
      component.createRepoForm.setValue({ name: 'new-online-repo', organization: 'Offscale' });
      component.onCreateRepo();
      expect(mockApi.createOrgRepo).toHaveBeenCalledWith(1, { name: 'new-online-repo' });

      // Also test created repo without languages array and error branch
      mockApi.createOrgRepo.mockReturnValue(of({ id: 301, name: 'repo-no-langs' }));
      component.showCreateForm.set(true);
      component.createRepoForm.setValue({ name: 'repo-no-langs', organization: 'Offscale' });
      component.onCreateRepo();

      mockApi.createOrgRepo.mockReturnValue(throwError(() => new Error('Create err')));
      component.showCreateForm.set(true);
      component.createRepoForm.setValue({ name: 'fail-repo', organization: 'Offscale' });
      component.onCreateRepo();
      expect(component.errorMessage()).toBe('Failed to create repository on backend.');

      // Delete repo online success & error
      const repo = component.repositories()[0];
      mockApi.deleteRepo.mockReturnValue(of(undefined));
      component.onDeleteRepo(repo);
      expect(mockApi.deleteRepo).toHaveBeenCalled();
      expect(component.statusMessage()).toContain('Deleted repository');

      const repo2 = component.repositories()[0];
      mockApi.deleteRepo.mockReturnValue(throwError(() => new Error('Del err')));
      component.onDeleteRepo(repo2);
      expect(component.errorMessage()).toContain('Failed to delete repository');
    });

    it('should list and create releases via ApiService when online', () => {
      const repo = { ...component.repositories()[0], id: '10', organizationId: undefined };
      mockApi.listReleases.mockReturnValue(of([{ id: 1, repository_id: 10, tag_name: 'v0.9.0' }]));
      component.openReleaseModal(repo);
      expect(mockApi.listReleases).toHaveBeenCalledWith(1, 10);
      expect(component.repoReleases()['10'].length).toBe(1);

      mockApi.createOrgRelease.mockReturnValue(
        of({ id: 2, repository_id: 10, tag_name: 'v1.0.0' }),
      );
      component.releaseForm.setValue({ tag_name: 'v1.0.0', name: '1.0', body: 'Body' });
      component.onCreateRelease();
      expect(mockApi.createOrgRelease).toHaveBeenCalledWith(1, 10, {
        tag_name: 'v1.0.0',
        name: '1.0',
        body: 'Body',
      });
      expect(component.repoReleases()['10'].length).toBe(2);

      // Also test when repoReleases[repo.id] was not initialized and listReleases fails
      const repoUninit = { ...component.repositories()[0], id: 'not-a-num' };
      mockApi.listReleases.mockReturnValue(throwError(() => new Error('No releases')));
      component.openReleaseModal(repoUninit);
      mockApi.createOrgRelease.mockReturnValue(of({ id: 3, repository_id: 1, tag_name: 'v2.0.0' }));
      component.releaseForm.setValue({ tag_name: 'v2.0.0', name: '', body: '' });
      component.onCreateRelease();
      expect(component.repoReleases()['not-a-num'].length).toBe(1);

      // Error branch on createOrgRelease
      component.openReleaseModal(repo);
      mockApi.createOrgRelease.mockReturnValue(throwError(() => new Error('Release err')));
      component.releaseForm.setValue({ tag_name: 'v3.0.0', name: '', body: '' });
      component.onCreateRelease();
      expect(component.errorMessage()).toBe('Failed to create release on backend.');
    });
  });
});
