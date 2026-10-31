/**
 * Dashboard repositories configuration page component.
 * @module app/pages/dashboard/repositories/repositories.component
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { GLOBAL_DATE } from '../../../tokens';
import { ApiService } from '../../../services/api.service';
import { BackendConfigService } from '../../../services/backend-config.service';
import { Release } from '../../../models/types';
import * as WorkspaceActions from '../../../store/actions';

/**
 * Represents a linked repository for SDK generation.
 */
interface Repository {
  /** The unique identifier of the repository */
  id: string;
  /** The GitHub path or name of the repository */
  name: string;
  /** The organization that owns the repository */
  organization: string;
  /** Optional numeric organization ID from backend */
  organizationId?: number;
  /** The URL to the OpenAPI schema, if linked */
  schemaUrl?: string;
  /** The list of languages configured for SDK generation */
  languages: string[];
}

/**
 * Component to display and configure linked repositories, schemas, SDK languages, and releases.
 */
@Component({
  selector: 'app-repositories',
  imports: [ReactiveFormsModule, A11yModule, MatButtonModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <h1 i18n="@@repositoriesTitle">Repositories</h1>
        <button type="button" mat-flat-button class="btn btn-primary" (click)="toggleCreateForm()">
          @if (showCreateForm()) {
            <span i18n="@@cancelRepoBtn">Cancel</span>
          } @else {
            <span i18n="@@linkRepoBtn">Link Repository</span>
          }
        </button>
      </div>

      @if (statusMessage()) {
        <div class="status-banner" role="status" aria-live="polite">
          {{ statusMessage() }}
        </div>
      }
      @if (errorMessage()) {
        <div class="error-banner" role="alert">
          {{ errorMessage() }}
        </div>
      }

      @if (showCreateForm()) {
        <div class="card create-repo-card">
          <h2 i18n="@@linkNewRepoHeading">Link New Repository</h2>
          <form [formGroup]="createRepoForm" (ngSubmit)="onCreateRepo()">
            <div class="form-group">
              <label for="repoName" i18n="@@repoNameLabel">Repository Name (GitHub path)</label>
              <input
                type="text"
                id="repoName"
                formControlName="name"
                class="form-control"
                placeholder="org/repo-name"
                i18n-placeholder="@@repoNamePlaceholder"
              />
            </div>
            <div class="form-group">
              <label for="orgId" i18n="@@repoOrgLabel">Organization</label>
              <select id="orgId" formControlName="organization" class="form-control">
                @for (orgOption of availableOrgs(); track orgOption.name) {
                  <option [value]="orgOption.name">{{ orgOption.name }}</option>
                }
              </select>
            </div>
            <button
              type="submit"
              mat-flat-button
              class="btn btn-primary"
              [disabled]="createRepoForm.invalid"
              i18n="@@linkSubmitBtn"
            >
              Link
            </button>
          </form>
        </div>
      }

      <div class="repo-list">
        @for (repo of repositories(); track repo.id) {
          <div class="card repo-card">
            <div class="repo-header">
              <div class="repo-title-group">
                <h3>{{ repo.name }}</h3>
                <span class="badge">{{ repo.organization }}</span>
              </div>
              <div class="repo-header-actions">
                @if (repo.schemaUrl) {
                  <button
                    type="button"
                    mat-stroked-button
                    class="btn btn-secondary open-workspace-btn"
                    (click)="openInWorkspace(repo)"
                    i18n="@@openInWorkspaceBtn"
                  >
                    Open in Workspace
                  </button>
                }
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary create-release-btn"
                  (click)="openReleaseModal(repo)"
                  i18n="@@createReleaseBtn"
                >
                  Create Release
                </button>
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary delete-repo-btn"
                  aria-label="Delete repository"
                  (click)="onDeleteRepo(repo)"
                  i18n="@@deleteRepoBtn"
                >
                  Delete Repository
                </button>
              </div>
            </div>

            <div class="repo-config">
              <div class="config-section">
                <h4 i18n="@@openApiSchemaHeading">OpenAPI Schema</h4>
                <div class="schema-info">
                  @if (repo.schemaUrl) {
                    <a
                      [href]="repo.schemaUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="schema-link"
                      >{{ repo.schemaUrl }}</a
                    >
                  } @else {
                    <span class="text-muted" i18n="@@noSchemaLinked">No schema linked</span>
                  }
                  <button
                    type="button"
                    class="btn btn-link"
                    (click)="openSchemaConfig(repo)"
                    i18n="@@configureSchemaBtn"
                  >
                    Configure
                  </button>
                </div>
              </div>

              <div class="config-section">
                <h4 i18n="@@configuredLanguagesHeading">Configured Languages</h4>
                <div class="languages-list">
                  @if (repo.languages.length) {
                    @for (lang of repo.languages; track lang) {
                      <span class="lang-badge">{{ lang }}</span>
                    }
                  } @else {
                    <span class="text-muted" i18n="@@noLanguagesConfigured"
                      >No languages configured</span
                    >
                  }
                  <button
                    type="button"
                    class="btn btn-link"
                    (click)="openLangConfig(repo)"
                    i18n="@@configureLanguagesBtn"
                  >
                    Configure
                  </button>
                </div>
              </div>
            </div>

            @if (repoReleases()[repo.id]?.length) {
              <div class="releases-section">
                <h4 i18n="@@repoReleasesHeading">Releases</h4>
                <div class="languages-list">
                  @for (rel of repoReleases()[repo.id]; track rel.id) {
                    <span class="lang-badge">{{ rel.tag_name }}</span>
                  }
                </div>
              </div>
            }
          </div>
        } @empty {
          <div class="empty-state">
            <p i18n="@@noRepositoriesLinkedMsg">No repositories linked yet.</p>
          </div>
        }
      </div>

      <!-- Config Modals -->
      @if (selectedRepoForSchema(); as selectedRepo) {
        <div
          class="modal-backdrop"
          (click)="closeSchemaConfig()"
          (keydown.escape)="closeSchemaConfig()"
          tabindex="-1"
        >
          <div
            class="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schema-dialog-title"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h2 id="schema-dialog-title" i18n="@@configureSchemaDialogTitle">
              Configure Schema for {{ selectedRepo.name }}
            </h2>
            <form [formGroup]="schemaForm" (ngSubmit)="onSaveSchema()">
              <div class="form-group">
                <label for="schemaUrl" i18n="@@schemaUrlLabel">OpenAPI Schema URL</label>
                <input
                  type="url"
                  id="schemaUrl"
                  formControlName="schemaUrl"
                  class="form-control"
                  placeholder="https://api.example.com/openapi.json"
                  i18n-placeholder="@@schemaUrlPlaceholder"
                />
              </div>
              <div class="modal-actions">
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary"
                  (click)="closeSchemaConfig()"
                  i18n="@@cancelSchemaBtn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  mat-flat-button
                  class="btn btn-primary"
                  i18n="@@saveSchemaBtn"
                >
                  Save Schema
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (selectedRepoForLang(); as selectedLangRepo) {
        <div
          class="modal-backdrop"
          (click)="closeLangConfig()"
          (keydown.escape)="closeLangConfig()"
          tabindex="-1"
        >
          <div
            class="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lang-dialog-title"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h2 id="lang-dialog-title" i18n="@@configureLangDialogTitle">
              Configure Languages for {{ selectedLangRepo.name }}
            </h2>
            <div class="lang-options">
              @for (lang of availableLanguages; track lang) {
                <label class="lang-option">
                  <input
                    type="checkbox"
                    [checked]="isLangSelected(lang)"
                    (change)="toggleLang(lang)"
                  />
                  {{ lang }}
                </label>
              }
            </div>
            <div class="modal-actions">
              <button
                type="button"
                mat-stroked-button
                class="btn btn-secondary"
                (click)="closeLangConfig()"
                i18n="@@closeLangBtn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      }

      @if (selectedRepoForRelease(); as selectedReleaseRepo) {
        <div
          class="modal-backdrop"
          (click)="closeReleaseModal()"
          (keydown.escape)="closeReleaseModal()"
          tabindex="-1"
        >
          <div
            class="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="release-dialog-title"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h2 id="release-dialog-title" i18n="@@createReleaseDialogTitle">
              Create Release for {{ selectedReleaseRepo.name }}
            </h2>
            <form [formGroup]="releaseForm" (ngSubmit)="onCreateRelease()">
              <div class="form-group">
                <label for="releaseTag" i18n="@@releaseTagLabel">Tag Name</label>
                <input
                  type="text"
                  id="releaseTag"
                  formControlName="tag_name"
                  class="form-control"
                  placeholder="v1.0.0"
                />
              </div>
              <div class="form-group">
                <label for="releaseName" i18n="@@releaseNameLabel">Release Title</label>
                <input
                  type="text"
                  id="releaseName"
                  formControlName="name"
                  class="form-control"
                  placeholder="Initial Release"
                />
              </div>
              <div class="form-group">
                <label for="releaseBody" i18n="@@releaseBodyLabel">Release Notes</label>
                <input
                  type="text"
                  id="releaseBody"
                  formControlName="body"
                  class="form-control"
                  placeholder="Generated SDKs for all configured languages"
                />
              </div>
              <div class="modal-actions">
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary"
                  (click)="closeReleaseModal()"
                  i18n="@@cancelReleaseBtn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  mat-flat-button
                  class="btn btn-primary"
                  [disabled]="releaseForm.invalid"
                  i18n="@@submitReleaseBtn"
                >
                  Publish Release
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .page-container {
      max-width: 1000px;
      margin: 0 auto;
    }
    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      h1 {
        margin: 0;
        color: var(--text-primary);
      }
    }
    .status-banner {
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border-radius: 6px;
      background: var(--primary-hover);
      color: var(--primary-color);
      font-size: 0.875rem;
    }
    .error-banner {
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border-radius: 6px;
      background: var(--error-bg);
      color: var(--error-text);
      font-size: 0.875rem;
    }
    .card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    .create-repo-card {
      margin-bottom: 2rem;
      h2 {
        margin-top: 0;
        font-size: 1.25rem;
      }
    }
    .repo-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .repo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
      flex-wrap: wrap;
      h3 {
        margin: 0;
        font-size: 1.25rem;
      }
    }
    .repo-title-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .repo-header-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .badge {
      background: var(--bg-color);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
      padding: 0.25rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .repo-config {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    .config-section,
    .releases-section {
      h4 {
        margin: 0 0 0.5rem 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
      }
    }
    .schema-info,
    .languages-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .schema-link {
      color: var(--primary-color);
      text-decoration: none;
      word-break: break-all;
      &:hover {
        text-decoration: underline;
      }
    }
    .lang-badge {
      background: var(--primary-hover);
      color: var(--primary-color);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .text-muted {
      color: var(--text-secondary);
      font-style: italic;
      font-size: 0.875rem;
    }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      font-size: 0.875rem;
    }
    .btn-primary {
      background-color: var(--primary-color);
      color: var(--mat-sys-on-primary, #ffffff);
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    .btn-secondary {
      background-color: var(--bg-color);
      color: var(--text-primary);
      border-color: var(--border-color);
    }
    .btn-link {
      background: none;
      color: var(--primary-color);
      padding: 0.25rem 0.5rem;
      &:hover {
        text-decoration: underline;
      }
    }
    .form-group {
      margin-bottom: 1rem;
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--text-primary);
      }
    }
    .form-control {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 0.875rem;
      box-sizing: border-box;
      background-color: var(--surface-color);
      color: var(--text-primary);
      &:focus {
        outline: 2px solid var(--primary-color);
        outline-offset: 1px;
        border-color: var(--primary-color);
      }
    }
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      width: 100%;
      max-width: 450px;
      h2 {
        margin-top: 0;
      }
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1.5rem;
    }
    .lang-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin: 1.5rem 0;
    }
    .lang-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }
    .empty-state {
      text-align: center;
      padding: 3rem;
      background: var(--surface-color);
      border: 1px dashed var(--border-color);
      border-radius: 6px;
      color: var(--text-secondary);
    }
  `,
})
/**
 * Component to display and configure linked repositories, schemas, and SDK languages.
 */
export class RepositoriesComponent implements OnInit {
  /** Global Date constructor. */
  private readonly globalDate = inject(GLOBAL_DATE);
  /** Backend API service. */
  private readonly api = inject(ApiService);
  /** Backend configuration service. */
  private readonly config = inject(BackendConfigService);
  /** Angular Router instance. */
  private readonly router = inject(Router);
  /** NgRx Store instance. */
  private readonly store = inject(Store);

  /**
   * List of available organizations for linking repositories.
   */
  readonly availableOrgs = signal<
    {
      /** Numeric organization ID. */
      id: number;
      /** Display name or login of the organization. */
      name: string;
    }[]
  >([
    { id: 1, name: 'Offscale' },
    { id: 2, name: 'Demo Team' },
  ]);

  /**
   * List of linked repositories
   */
  repositories = signal<Repository[]>([
    {
      id: 'repo-1',
      name: 'offscale/cdd-ctl',
      organization: 'Offscale',
      organizationId: 1,
      schemaUrl: 'https://raw.githubusercontent.com/offscale/cdd-ctl/main/openapi.yaml',
      languages: ['TypeScript', 'Rust', 'Python'],
    },
    {
      id: 'repo-2',
      name: 'demo/payment-service',
      organization: 'Demo Team',
      organizationId: 2,
      languages: ['Go', 'Java'],
    },
  ]);

  /** Map of repository IDs to their published releases. */
  readonly repoReleases = signal<Record<string, Release[]>>({});

  /**
   * Available languages for SDK generation across all 13 CDD ecosystems.
   */
  availableLanguages = [
    'TypeScript',
    'Rust',
    'Python',
    'Go',
    'Java',
    'C#',
    'C++',
    'C',
    'Kotlin',
    'PHP',
    'Ruby',
    'Swift',
    'Shell',
  ];

  /**
   * Whether the create form is visible
   */
  showCreateForm = signal(false);
  /**
   * Repository selected for schema configuration
   */
  selectedRepoForSchema = signal<Repository | null>(null);
  /**
   * Repository selected for language configuration
   */
  selectedRepoForLang = signal<Repository | null>(null);
  /**
   * Repository selected for creating a release
   */
  selectedRepoForRelease = signal<Repository | null>(null);

  /** Status message signal for backend actions. */
  readonly statusMessage = signal<string | null>(null);
  /** Error message signal for backend actions. */
  readonly errorMessage = signal<string | null>(null);

  /**
   * Form group for linking a new repository
   */
  createRepoForm = new FormGroup({
    name: new FormControl('', Validators.required),
    organization: new FormControl('Offscale', Validators.required),
  });

  /**
   * Form group for configuring a schema
   */
  schemaForm = new FormGroup({
    schemaUrl: new FormControl('', Validators.required),
  });

  /**
   * Form group for creating a release
   */
  releaseForm = new FormGroup({
    tag_name: new FormControl('', Validators.required),
    name: new FormControl(''),
    body: new FormControl(''),
  });

  /**
   * Initializes the component and loads organizations and repositories when online.
   */
  ngOnInit(): void {
    if (this.config.isOnline()) {
      this.loadRemoteRepositories();
    }
  }

  /**
   * Loads organizations and their repositories from `cdd-control-plane`.
   */
  loadRemoteRepositories(): void {
    this.api.listOrgs().subscribe({
      next: (orgs) => {
        if (orgs.length > 0) {
          this.availableOrgs.set(
            orgs.map((o) => ({
              id: Number(o.id),
              name: o.name || o.login,
            })),
          );
          this.repositories.set([]);
          this.errorMessage.set(null);
          const loadedRepos: Repository[] = [];
          for (const org of orgs) {
            const orgId = Number(org.id);
            const orgName = org.name || org.login;
            this.api.listRepos(orgId).subscribe({
              next: (repos) => {
                for (const r of repos) {
                  loadedRepos.push({
                    id: String(r.id),
                    name: r.name,
                    organization: orgName,
                    organizationId: orgId,
                    schemaUrl: r.schemaUrl ?? r.specUrl,
                    languages: r.languages ?? ['TypeScript', 'Rust'],
                  });
                }
                this.repositories.set([...loadedRepos]);
              },
              error: () => {
                this.errorMessage.set(`Failed to load repositories for ${orgName}.`);
              },
            });
          }
        } else {
          this.availableOrgs.set([]);
          this.repositories.set([]);
          this.errorMessage.set(null);
        }
      },
      error: () => {
        this.errorMessage.set('Failed to load organizations from backend.');
      },
    });
  }

  /**
   * Toggles the visibility of the create form
   */
  toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
    if (!this.showCreateForm()) {
      this.createRepoForm.reset({ organization: 'Offscale' });
    }
  }

  /**
   * Handles linking a new repository
   */
  onCreateRepo(): void {
    if (this.createRepoForm.valid) {
      const repoName = this.createRepoForm.value.name || '';
      const orgName = this.createRepoForm.value.organization || 'Offscale';
      const matchingOrg = this.availableOrgs().find((o) => o.name === orgName);
      const orgId = matchingOrg?.id ?? 1;

      if (this.config.isOnline()) {
        this.api.createOrgRepo(orgId, { name: repoName }).subscribe({
          next: (created) => {
            const newRepo: Repository = {
              id: String(created.id),
              name: created.name,
              organization: orgName,
              organizationId: orgId,
              languages: created.languages ?? [],
            };
            this.repositories.update((repos) => [...repos, newRepo]);
            this.errorMessage.set(null);
            this.toggleCreateForm();
          },
          error: () => {
            this.errorMessage.set('Failed to create repository on backend.');
          },
        });
        return;
      }

      const newRepo: Repository = {
        id: `repo-${this.globalDate.now()}`,
        name: repoName,
        organization: orgName,
        organizationId: orgId,
        languages: [],
      };
      this.repositories.update((repos) => [...repos, newRepo]);
      this.toggleCreateForm();
    }
  }

  /**
   * Deletes/unlinks a repository on the backend (when online) and removes it from the list.
   * @param repo The repository to delete.
   */
  onDeleteRepo(repo: Repository): void {
    const orgId = repo.organizationId ?? 1;
    if (this.config.isOnline()) {
      this.api.deleteRepo(orgId, repo.id).subscribe({
        next: () => {
          this.repositories.update((repos) => repos.filter((r) => r.id !== repo.id));
          this.statusMessage.set(`Deleted repository ${repo.name}.`);
          this.errorMessage.set(null);
        },
        error: () => {
          this.errorMessage.set(`Failed to delete repository ${repo.name}.`);
        },
      });
      return;
    }
    this.repositories.update((repos) => repos.filter((r) => r.id !== repo.id));
  }

  /**
   * Opens the repository's linked OpenAPI specification in the interactive Workspace.
   * @param repo The repository whose schema URL should be opened.
   */
  openInWorkspace(repo: Repository): void {
    if (repo.schemaUrl) {
      this.store.dispatch(
        WorkspaceActions.addOpenApiUrl({
          url: repo.schemaUrl,
        }),
      );
      void this.router.navigate(['/']);
    }
  }

  /**
   * Opens the Create Release modal for a repository and loads existing releases when online.
   * @param repo The repository to create a release for.
   */
  openReleaseModal(repo: Repository): void {
    this.selectedRepoForRelease.set(repo);
    this.releaseForm.reset({ tag_name: 'v1.0.0', name: '', body: '' });
    if (this.config.isOnline()) {
      const orgId = repo.organizationId ?? 1;
      const repoId = Number(repo.id) || 1;
      this.api.listReleases(orgId, repoId).subscribe({
        next: (releases) => {
          this.repoReleases.update((map) => ({ ...map, [repo.id]: releases }));
        },
        error: () => {
          // Ignore error if no releases exist yet
        },
      });
    }
  }

  /**
   * Closes the Create Release modal.
   */
  closeReleaseModal(): void {
    this.selectedRepoForRelease.set(null);
  }

  /**
   * Submits the Create Release form (`POST /api/v1/orgs/{org_id}/repos/{repo_id}/releases`).
   */
  onCreateRelease(): void {
    if (this.releaseForm.valid) {
      const repo = this.selectedRepoForRelease();
      if (repo) {
        const tag_name = this.releaseForm.value.tag_name || 'v1.0.0';
        const name = this.releaseForm.value.name || undefined;
        const body = this.releaseForm.value.body || undefined;
        const orgId = repo.organizationId ?? 1;
        const repoId = Number(repo.id) || 1;

        if (this.config.isOnline()) {
          this.api.createOrgRelease(orgId, repoId, { tag_name, name, body }).subscribe({
            next: (created) => {
              this.repoReleases.update((map) => ({
                ...map,
                [repo.id]: [...(map[repo.id] ?? []), created],
              }));
              this.statusMessage.set(`Release ${created.tag_name} created and queued.`);
              this.errorMessage.set(null);
              this.closeReleaseModal();
            },
            error: () => {
              this.errorMessage.set('Failed to create release on backend.');
            },
          });
          return;
        }

        const localRelease: Release = {
          id: this.globalDate.now(),
          repository_id: repoId,
          tag_name,
          name: name ?? null,
          body: body ?? null,
        };
        this.repoReleases.update((map) => ({
          ...map,
          [repo.id]: [...(map[repo.id] ?? []), localRelease],
        }));
      }
      this.closeReleaseModal();
    }
  }

  /**
   * Opens the schema configuration modal for a repository
   * @param repo The repository to configure
   */
  openSchemaConfig(repo: Repository): void {
    this.selectedRepoForSchema.set(repo);
    this.schemaForm.setValue({ schemaUrl: repo.schemaUrl || '' });
  }

  /**
   * Closes the schema configuration modal
   */
  closeSchemaConfig(): void {
    this.selectedRepoForSchema.set(null);
  }

  /**
   * Saves the configured schema URL for the selected repository
   */
  onSaveSchema(): void {
    if (this.schemaForm.valid) {
      const repo = this.selectedRepoForSchema();
      if (repo) {
        this.repositories.update((repos) =>
          repos.map((r) =>
            r.id === repo.id ? { ...r, schemaUrl: this.schemaForm.value.schemaUrl || '' } : r,
          ),
        );
      }
      this.closeSchemaConfig();
    }
  }

  /**
   * Opens the language configuration modal for a repository
   * @param repo The repository to configure
   */
  openLangConfig(repo: Repository): void {
    this.selectedRepoForLang.set(repo);
  }

  /**
   * Closes the language configuration modal
   */
  closeLangConfig(): void {
    this.selectedRepoForLang.set(null);
  }

  /**
   * Checks if a language is selected for the currently active repository
   * @param lang The language to check
   * @returns True if the language is selected, false otherwise
   */
  isLangSelected(lang: string): boolean {
    const repo = this.selectedRepoForLang();
    return repo ? repo.languages.includes(lang) : false;
  }

  /**
   * Toggles a language selection for the currently active repository
   * @param lang The language to toggle
   */
  toggleLang(lang: string): void {
    const repo = this.selectedRepoForLang();
    if (!repo) return;

    const currentLangs = repo.languages;
    const updatedLanguages = currentLangs.includes(lang)
      ? currentLangs.filter((l) => l !== lang)
      : [...currentLangs, lang];

    this.repositories.update((repos) =>
      repos.map((r) => (r.id === repo.id ? { ...r, languages: updatedLanguages } : r)),
    );

    // Update local selected state to refresh view immediately
    this.selectedRepoForLang.set({
      ...repo,
      languages: updatedLanguages,
    });
  }
}
