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
    updateOrgRepo: ReturnType<typeof vi.fn>;
    deleteRepo: ReturnType<typeof vi.fn>;
    listReleases: ReturnType<typeof vi.fn>;
    createOrgRelease: ReturnType<typeof vi.fn>;
    listGithubOrgs: ReturnType<typeof vi.fn>;
    provisionGithubRepos: ReturnType<typeof vi.fn>;
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
      updateOrgRepo: vi.fn(),
      deleteRepo: vi.fn(),
      listReleases: vi.fn(),
      createOrgRelease: vi.fn(),
      listGithubOrgs: vi.fn().mockReturnValue(of([{ id: 1, login: 'offscale' }])),
      provisionGithubRepos: vi.fn(),
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

  it('should toggle create form and topology wizard', () => {
    expect(component.showCreateForm()).toBe(false);
    component.toggleCreateForm();
    expect(component.showCreateForm()).toBe(true);

    component.createRepoForm.controls.name.setValue('test');
    component.toggleCreateForm();
    expect(component.showCreateForm()).toBe(false);
    expect(component.createRepoForm.value.name).toBeNull();

    expect(component.showTopologyWizard()).toBe(false);
    component.toggleTopologyWizard();
    expect(component.showTopologyWizard()).toBe(true);
    component.toggleTopologyWizard();
    expect(component.showTopologyWizard()).toBe(false);
  });

  it('should manage Monorepo vs. Polyrepo Wizard state and provision repositories in offline mode', () => {
    component.onSyncGithubOrgs();
    expect(component.statusMessage()).toBe('Loaded local GitHub organization presets.');

    // Changing GitHub org updates default monorepoName and polyrepoNames reactively
    component.onGithubOrgChange('acme-corp');
    expect(component.topologyConfig().githubOrgName).toBe('acme-corp');
    expect(component.topologyConfig().monorepoName).toBe('acme-corp-sdk');
    expect(component.defaultMonorepoPreview()).toBe('acme-corp-sdk');
    expect(component.getPolyrepoNameForLanguage('TypeScript')).toBe('acme-corp-sdk-ts');
    expect(component.getPolyrepoNameForLanguage('Kotlin')).toBe('acme-corp-sdk-kotlin');

    // Custom monorepo name is preserved on org change until resetMonorepoName() is called
    component.onMonorepoNameChange('custom-acme-monorepo');
    component.onGithubOrgChange('beta-inc');
    expect(component.topologyConfig().monorepoName).toBe('custom-acme-monorepo');
    component.resetMonorepoName();
    expect(component.topologyConfig().monorepoName).toBe('beta-inc-sdk');

    // Custom polyrepo name is preserved on org change until resetPolyrepoNames() is called
    component.onSetTopologyMode('polyrepo');
    expect(component.topologyConfig().topologyMode).toBe('polyrepo');
    component.onPolyrepoNameChange('Rust', 'custom-rust-sdk');
    component.onGithubOrgChange('gamma-org');
    expect(component.getPolyrepoNameForLanguage('Rust')).toBe('custom-rust-sdk');
    expect(component.getPolyrepoNameForLanguage('TypeScript')).toBe('gamma-org-sdk-ts');
    component.resetPolyrepoNames();
    expect(component.getPolyrepoNameForLanguage('Rust')).toBe('gamma-org-sdk-rust');

    // Wizard language selection helpers
    component.toggleWizardLanguage('Go');
    expect(component.wizardLanguages()).toContain('Go');
    component.toggleWizardLanguage('Go');
    expect(component.wizardLanguages()).not.toContain('Go');

    component.selectAllWizardLanguages();
    expect(component.wizardLanguages().length).toBe(13);

    component.clearWizardLanguages();
    expect(component.wizardLanguages().length).toBe(0);
    // Provisioning with 0 languages is a no-op
    const countBefore = component.repositories().length;
    component.onProvisionTopologyRepos();
    expect(component.repositories().length).toBe(countBefore);

    // Offline Monorepo provisioning (with blank monorepoName fallback and custom monorepoName)
    component.toggleWizardLanguage('TypeScript');
    component.toggleWizardLanguage('Rust');
    component.onSetTopologyMode('monorepo');
    component.onMonorepoNameChange('   ');
    component.onProvisionTopologyRepos();
    expect(component.repositories().length).toBe(countBefore + 1);
    expect(component.repositories()[countBefore].name).toBe('gamma-org/gamma-org-sdk');

    // Offline Polyrepo provisioning creates 1 repo per selected language
    component.onSetTopologyMode('polyrepo');
    component.onProvisionTopologyRepos();
    expect(component.repositories().length).toBe(countBefore + 3);
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

  it('should handle schema config and multi-spec format auto-detection', () => {
    expect(component.detectSpecFormatFromUrl('https://example.com/workflow.arazzo.json')).toBe(
      'arazzo',
    );
    expect(
      component.detectSpecFormatFromUrl(
        'https://www.googleapis.com/discovery/v1/apis/compute/v1/rest',
      ),
    ).toBe('google_discovery');
    expect(component.detectSpecFormatFromUrl('https://petstore.swagger.io/v2/swagger.json')).toBe(
      'swagger',
    );
    expect(component.detectSpecFormatFromUrl('https://api.example.com/openapi.yaml')).toBe(
      'openapi',
    );

    const repo = component.repositories()[0];
    component.openSchemaConfig(repo);
    expect(component.selectedRepoForSchema()).toEqual(repo);

    component.onSchemaUrlInput('https://example.com/platform.arazzo.json');
    expect(component.schemaForm.controls.specFormat.value).toBe('arazzo');

    component.schemaForm.controls.schemaUrl.setValue('http://new-schema');
    component.onSaveSchema();

    expect(component.repositories()[0].schemaUrl).toBe('http://new-schema');
    expect(component.repositories()[0].specFormat).toBe('arazzo');
    expect(component.selectedRepoForSchema()).toBeNull();
  });

  it('should handle schema config when repo has no schemaUrl/specFormat and schemaForm has falsy values', () => {
    const repo = component.repositories()[0];
    const repoWithoutSchema = { ...repo, schemaUrl: undefined, specFormat: undefined };

    component.openSchemaConfig(repoWithoutSchema);
    expect(component.schemaForm.value.schemaUrl).toBe('');
    expect(component.schemaForm.value.specFormat).toBe('openapi');

    component.schemaForm.controls.schemaUrl.clearValidators();
    component.schemaForm.setValue({ schemaUrl: null, specFormat: null });
    component.onSaveSchema();

    expect(component.repositories()[0].schemaUrl).toBe('');
    expect(component.repositories()[0].specFormat).toBe('openapi');
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

  it('should handle language config open/close, selectAll, clearAll, and per-language CLI/MCP options', () => {
    const repo = component.repositories()[0];
    component.openLangConfig(repo);
    expect(component.selectedRepoForLang()).toEqual(repo);

    component.selectAllRepoLanguages();
    expect(component.selectedRepoForLang()?.languages.length).toBe(13);

    expect(component.getRepoLangOption('TypeScript', 'cli')).toBe(false);
    component.toggleRepoLangOption('TypeScript', 'cli');
    expect(component.getRepoLangOption('TypeScript', 'cli')).toBe(true);
    component.toggleRepoLangOption('TypeScript', 'mcp');
    expect(component.getRepoLangOption('TypeScript', 'mcp')).toBe(true);
    component.toggleRepoLangOption('TypeScript', 'cli');
    expect(component.getRepoLangOption('TypeScript', 'cli')).toBe(false);

    component.clearRepoLanguages();
    expect(component.selectedRepoForLang()?.languages.length).toBe(0);

    component.onSaveLangConfig();
    expect(component.selectedRepoForLang()).toBeNull();

    // No-op guards when selectedRepoForLang is null
    component.selectAllRepoLanguages();
    component.clearRepoLanguages();
    component.toggleRepoLangOption('TypeScript', 'cli');
    expect(component.getRepoLangOption('TypeScript', 'cli')).toBe(false);
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

  it('should delete repo, open in workspace, and create release with registries, PGP, and docs in offline mode', () => {
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

    // Release modal toggles (registries, PGP, docs)
    component.toggleReleaseRegistry('maven');
    expect(component.selectedReleaseRegistries()).toContain('maven');
    component.toggleReleaseRegistry('maven');
    expect(component.selectedReleaseRegistries()).not.toContain('maven');

    component.togglePgpSigning();
    expect(component.enablePgpSigning()).toBe(false);
    component.togglePgpSigning();
    expect(component.enablePgpSigning()).toBe(true);

    component.toggleDocsPublish();
    expect(component.docsPublishEnabled()).toBe(false);
    component.toggleDocsPublish();
    expect(component.docsPublishEnabled()).toBe(true);
    component.onDocsTargetChange('readthedocs');
    expect(component.docsPublishTarget()).toBe('readthedocs');

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

    it('should load remote organizations, repositories, and GitHub orgs on ngOnInit and handle errors', () => {
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
      mockApi.listGithubOrgs.mockReturnValue(of([{ id: 1, login: 'acme-gh' }]));

      component.ngOnInit();
      expect(component.availableOrgs().length).toBe(2);
      expect(component.repositories().length).toBe(2);
      expect(component.githubOrgs()[0].login).toBe('acme-gh');

      // Empty github orgs and error branch
      mockApi.listGithubOrgs.mockReturnValueOnce(of([]));
      component.onSyncGithubOrgs();
      mockApi.listGithubOrgs.mockReturnValueOnce(throwError(() => new Error('GH orgs err')));
      component.onSyncGithubOrgs();

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

    it('should provision monorepo or polyrepos online via ApiService and handle errors', () => {
      component.onSetTopologyMode('monorepo');
      mockApi.provisionGithubRepos.mockReturnValueOnce(
        of([{ id: 500, name: 'offscale-sdk', organization_id: 1, languages: ['TypeScript'] }]),
      );
      component.onProvisionTopologyRepos();
      expect(mockApi.provisionGithubRepos).toHaveBeenCalled();
      expect(component.statusMessage()).toContain('monorepo');

      component.onSetTopologyMode('polyrepo');
      mockApi.provisionGithubRepos.mockReturnValueOnce(of([{ id: 501, name: 'offscale-sdk-ts' }]));
      component.onProvisionTopologyRepos();
      expect(component.statusMessage()).toContain('polyrepo');

      mockApi.provisionGithubRepos.mockReturnValueOnce(
        throwError(() => new Error('Provision failed')),
      );
      component.onProvisionTopologyRepos();
      expect(component.errorMessage()).toBe('Failed to provision GitHub repositories on backend.');
    });

    it('should update schema and language configs online via updateOrgRepo and handle errors', () => {
      const repo = { ...component.repositories()[0], organizationId: undefined };
      component.openSchemaConfig(repo);
      mockApi.updateOrgRepo.mockReturnValueOnce(of({ id: 1, name: repo.name }));
      component.schemaForm.setValue({
        schemaUrl: 'https://example.com/spec.json',
        specFormat: 'openapi',
      });
      component.onSaveSchema();
      expect(mockApi.updateOrgRepo).toHaveBeenCalled();
      expect(component.statusMessage()).toContain('Updated specification');

      component.openSchemaConfig(repo);
      mockApi.updateOrgRepo.mockReturnValueOnce(throwError(() => new Error('Schema update err')));
      component.onSaveSchema();
      expect(component.errorMessage()).toContain('Failed to update specification');

      // Language config online save & error
      component.openLangConfig(repo);
      mockApi.updateOrgRepo.mockReturnValueOnce(of({ id: 1, name: repo.name }));
      component.onSaveLangConfig();
      expect(component.statusMessage()).toContain('Saved language configuration');

      component.openLangConfig(repo);
      mockApi.updateOrgRepo.mockReturnValueOnce(throwError(() => new Error('Lang save err')));
      component.onSaveLangConfig();
      expect(component.errorMessage()).toContain('Failed to save language configuration');
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
      expect(mockApi.createOrgRelease).toHaveBeenCalledWith(
        1,
        10,
        expect.objectContaining({
          tag_name: 'v1.0.0',
          name: '1.0',
          body: 'Body',
          enable_pgp_signing: true,
        }),
      );
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
