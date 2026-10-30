/**
 * Dashboard repositories configuration page component.
 * @module app/pages/dashboard/repositories/repositories.component
 */
import { Component, signal, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { GLOBAL_DATE } from '../../../tokens';

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
  /** The URL to the OpenAPI schema, if linked */
  schemaUrl?: string;
  /** The list of languages configured for SDK generation */
  languages: string[];
}

/**
 * Component to display and configure linked repositories, schemas, and SDK languages.
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
                <option value="Offscale">Offscale</option>
                <option value="Demo Team">Demo Team</option>
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
              <h3>{{ repo.name }}</h3>
              <span class="badge">{{ repo.organization }}</span>
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
      gap: 1rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
      h3 {
        margin: 0;
        font-size: 1.25rem;
      }
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
    .config-section {
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
      border: none;
      color: var(--primary-color);
      padding: 0;
      font-size: 0.875rem;
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
      max-width: 500px;
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
      margin-top: 1rem;
    }
    .lang-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
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
export class RepositoriesComponent {
  /** Global Date constructor. */
  private readonly globalDate = inject(GLOBAL_DATE);

  /**
   * List of linked repositories
   */
  repositories = signal<Repository[]>([
    {
      id: 'repo-1',
      name: 'offscale/acme-api',
      organization: 'Offscale',
      schemaUrl: 'https://raw.githubusercontent.com/offscale/acme-api/main/openapi.json',
      languages: ['TypeScript', 'Rust', 'Python'],
    },
    {
      id: 'repo-2',
      name: 'demo-team/core-services',
      organization: 'Demo Team',
      languages: ['Go', 'Java'],
    },
  ]);

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
   * List of available languages for SDK generation
   */
  availableLanguages = ['TypeScript', 'Rust', 'Python', 'Go', 'Java', 'C#', 'C++', 'Ruby', 'PHP'];

  /**
   * Form group for creating a new repository link
   */
  createRepoForm = new FormGroup({
    name: new FormControl('', Validators.required),
    organization: new FormControl('Offscale', Validators.required),
  });

  /**
   * Form group for updating a repository's schema URL
   */
  schemaForm = new FormGroup({
    schemaUrl: new FormControl('', [Validators.required]),
  });

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
   * Handles creating a new repository link
   */
  onCreateRepo(): void {
    if (this.createRepoForm.valid) {
      const formValue = this.createRepoForm.value;
      const newRepo: Repository = {
        id: `repo-${this.globalDate.now()}`,
        name: formValue.name || '',
        organization: formValue.organization || 'Offscale',
        languages: [],
      };
      this.repositories.update((repos) => [...repos, newRepo]);
      this.toggleCreateForm();
    }
  }

  /**
   * Opens the schema configuration modal for a repository
   * @param repo The repository to configure
   */
  openSchemaConfig(repo: Repository): void {
    this.selectedRepoForSchema.set(repo);
    this.schemaForm.reset({ schemaUrl: repo.schemaUrl || '' });
  }

  /**
   * Closes the schema configuration modal
   */
  closeSchemaConfig(): void {
    this.selectedRepoForSchema.set(null);
  }

  /**
   * Handles saving the schema URL
   */
  onSaveSchema(): void {
    if (this.schemaForm.valid) {
      const repo = this.selectedRepoForSchema();
      const schemaUrl = this.schemaForm.value.schemaUrl || '';

      if (repo) {
        this.repositories.update((repos) =>
          repos.map((r) => (r.id === repo.id ? { ...r, schemaUrl } : r)),
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
   * @returns True if the language is selected
   */
  isLangSelected(lang: string): boolean {
    const repo = this.selectedRepoForLang();
    return repo ? repo.languages.includes(lang) : false;
  }

  /**
   * Toggles a language for the currently selected repository
   * @param lang The language to toggle
   */
  toggleLang(lang: string): void {
    const repo = this.selectedRepoForLang();
    if (!repo) return;

    const hasLang = repo.languages.includes(lang);
    const updatedLanguages = hasLang
      ? repo.languages.filter((l) => l !== lang)
      : [...repo.languages, lang];

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
