import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

interface Repository {
  id: string;
  name: string;
  organization: string;
  schemaUrl?: string;
  languages: string[];
}

@Component({
  selector: 'app-repositories',
  imports: [ReactiveFormsModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <h1>Repositories</h1>
        <button class="btn btn-primary" (click)="toggleCreateForm()">
          {{ showCreateForm() ? 'Cancel' : 'Link Repository' }}
        </button>
      </div>

      @if (showCreateForm()) {
        <div class="card create-repo-card">
          <h2>Link New Repository</h2>
          <form [formGroup]="createRepoForm" (ngSubmit)="onCreateRepo()">
            <div class="form-group">
              <label for="repoName">Repository Name (GitHub path)</label>
              <input 
                type="text" 
                id="repoName" 
                formControlName="name" 
                class="form-control" 
                placeholder="org/repo-name"
              />
            </div>
            <div class="form-group">
              <label for="orgId">Organization</label>
              <select id="orgId" formControlName="organization" class="form-control">
                <option value="Offscale">Offscale</option>
                <option value="Demo Team">Demo Team</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary" [disabled]="createRepoForm.invalid">Link</button>
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
                <h4>OpenAPI Schema</h4>
                <div class="schema-info">
                  @if (repo.schemaUrl) {
                    <a [href]="repo.schemaUrl" target="_blank" class="schema-link">{{ repo.schemaUrl }}</a>
                  } @else {
                    <span class="text-muted">No schema linked</span>
                  }
                  <button class="btn btn-link" (click)="openSchemaConfig(repo)">Configure</button>
                </div>
              </div>
              
              <div class="config-section">
                <h4>Configured Languages</h4>
                <div class="languages-list">
                  @if (repo.languages.length) {
                    @for (lang of repo.languages; track lang) {
                      <span class="lang-badge">{{ lang }}</span>
                    }
                  } @else {
                    <span class="text-muted">No languages configured</span>
                  }
                  <button class="btn btn-link" (click)="openLangConfig(repo)">Configure</button>
                </div>
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <p>No repositories linked yet.</p>
          </div>
        }
      </div>

      <!-- Config Modals -->
      @if (selectedRepoForSchema()) {
        <div class="modal-backdrop">
          <div class="modal card">
            <h2>Configure Schema for {{ selectedRepoForSchema()?.name }}</h2>
            <form [formGroup]="schemaForm" (ngSubmit)="onSaveSchema()">
              <div class="form-group">
                <label for="schemaUrl">OpenAPI Schema URL</label>
                <input 
                  type="url" 
                  id="schemaUrl" 
                  formControlName="schemaUrl" 
                  class="form-control" 
                  placeholder="https://api.example.com/openapi.json"
                />
              </div>
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeSchemaConfig()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Schema</button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (selectedRepoForLang()) {
        <div class="modal-backdrop">
          <div class="modal card">
            <h2>Configure Languages for {{ selectedRepoForLang()?.name }}</h2>
            <div class="lang-options">
              @for (lang of availableLanguages; track lang) {
                <label class="lang-option">
                  <input type="checkbox" [checked]="isLangSelected(lang)" (change)="toggleLang(lang)" />
                  {{ lang }}
                </label>
              }
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="closeLangConfig()">Close</button>
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
      h1 { margin: 0; color: var(--color-text-default, #24292f); }
    }
    .card {
      background: var(--color-bg-default, #ffffff);
      border: 1px solid var(--color-border-default, #d0d7de);
      border-radius: 6px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    .create-repo-card {
      margin-bottom: 2rem;
      h2 { margin-top: 0; font-size: 1.25rem; }
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
      border-bottom: 1px solid var(--color-border-default, #d0d7de);
      padding-bottom: 1rem;
      h3 { margin: 0; font-size: 1.25rem; }
    }
    .badge {
      background: var(--color-bg-subtle, #f5f5f5);
      color: var(--color-text-muted, #57606a);
      border: 1px solid var(--color-border-default, #d0d7de);
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
      h4 { margin: 0 0 0.5rem 0; font-size: 0.875rem; color: var(--color-text-muted, #57606a); }
    }
    .schema-info, .languages-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .schema-link {
      color: #0969da;
      text-decoration: none;
      word-break: break-all;
      &:hover { text-decoration: underline; }
    }
    .lang-badge {
      background: #eef2ff;
      color: #4f46e5;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .text-muted { color: var(--color-text-muted, #57606a); font-style: italic; font-size: 0.875rem; }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      font-size: 0.875rem;
    }
    .btn-primary {
      background-color: #2da44e;
      color: white;
      border-color: rgba(27, 31, 36, 0.15);
      &:hover { background-color: #2c974b; }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }
    .btn-secondary {
      background-color: #f6f8fa;
      color: #24292f;
      border-color: rgba(27, 31, 36, 0.15);
      &:hover { background-color: #f3f4f6; }
    }
    .btn-link {
      background: none;
      border: none;
      color: #0969da;
      padding: 0;
      font-size: 0.875rem;
      &:hover { text-decoration: underline; }
    }
    .form-group {
      margin-bottom: 1rem;
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--color-text-default, #24292f);
      }
    }
    .form-control {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-border-default, #d0d7de);
      border-radius: 6px;
      font-size: 0.875rem;
      box-sizing: border-box;
      &:focus {
        outline: none;
        border-color: #0969da;
        box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
      }
    }
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      width: 100%;
      max-width: 500px;
      h2 { margin-top: 0; }
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
      background: var(--color-bg-default, #ffffff);
      border: 1px dashed var(--color-border-default, #d0d7de);
      border-radius: 6px;
      color: var(--color-text-muted, #57606a);
    }
  `
})
export class RepositoriesComponent {
  /**
   * List of linked repositories
   */
  repositories = signal<Repository[]>([
    { 
      id: 'repo-1', 
      name: 'offscale/acme-api', 
      organization: 'Offscale',
      schemaUrl: 'https://raw.githubusercontent.com/offscale/acme-api/main/openapi.json',
      languages: ['TypeScript', 'Rust', 'Python']
    },
    { 
      id: 'repo-2', 
      name: 'demo-team/core-services', 
      organization: 'Demo Team',
      languages: ['Go', 'Java']
    }
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
    organization: new FormControl('Offscale', Validators.required)
  });

  /**
   * Form group for updating a repository's schema URL
   */
  schemaForm = new FormGroup({
    schemaUrl: new FormControl('', [Validators.required])
  });

  /**
   * Toggles the visibility of the create form
   */
  toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
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
        id: `repo-${Date.now()}`,
        name: formValue.name || '',
        organization: formValue.organization || 'Offscale',
        languages: []
      };
      this.repositories.update(repos => [...repos, newRepo]);
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
        this.repositories.update(repos => repos.map(r => 
          r.id === repo.id ? { ...r, schemaUrl } : r
        ));
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

    this.repositories.update(repos => repos.map(r => {
      if (r.id === repo.id) {
        const hasLang = r.languages.includes(lang);
        const newLangs = hasLang 
          ? r.languages.filter(l => l !== lang)
          : [...r.languages, lang];
        return { ...r, languages: newLangs };
      }
      return r;
    }));
    
    // Update local selected state to refresh view immediately
    this.selectedRepoForLang.update(r => {
      /* istanbul ignore if */
      if (!r) return null;
      return { ...r, languages: r.languages.includes(lang) ? r.languages.filter(l => l !== lang) : [...r.languages, lang] };
    });
  }
}
