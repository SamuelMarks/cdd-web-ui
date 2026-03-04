import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StorageService } from '../../services/storage.service';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/**
 * Component for viewing and managing an organization's repositories.
 */
@Component({
  selector: 'app-organization',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="container">
      <div class="breadcrumb" aria-label="Breadcrumb">
        <a mat-button routerLink="/dashboard" i18n="@@backToDashboard">← Back to Dashboard</a>
      </div>

      @if (organization()) {
        <header class="organization-header">
          <h2 i18n="@@organizationTitle">Organization: {{ organization()?.login }}</h2>
        </header>

        <mat-card class="create-repository" appearance="outlined">
          <mat-card-content>
            <h3 id="create-repo-title" i18n="@@createNewRepositoryHeading">
              Create New Repository
            </h3>
            <form
              [formGroup]="repositoryForm"
              (ngSubmit)="onCreateRepository()"
              class="inline-form"
              aria-labelledby="create-repo-title"
            >
              <mat-form-field appearance="outline" class="flex-field" subscriptSizing="dynamic">
                <mat-label i18n="@@repositoryNameLabel">Repository Name</mat-label>
                <input
                  matInput
                  formControlName="name"
                  placeholder="e.g. user-api"
                  i18n-placeholder="@@repositoryNamePlaceholder"
                  aria-label="Enter repository name"
                />
              </mat-form-field>
              <button
                mat-flat-button
                color="primary"
                type="submit"
                [disabled]="repositoryForm.invalid"
                i18n="@@createRepositoryBtn"
                aria-label="Create new repository"
              >
                Create Repository
              </button>
            </form>
          </mat-card-content>
        </mat-card>

        <div class="repositories-list">
          <h3 i18n="@@repositoriesHeading">Repositories</h3>
          @if (repositories().length === 0) {
            <div class="empty-state">
              <p i18n="@@noRepositoriesYet">No repositories yet. Create one above.</p>
            </div>
          } @else {
            <div class="grid">
              @for (repo of repositories(); track repo.id) {
                <mat-card
                  class="repo-card hoverable"
                  [routerLink]="['/repository', repo.id]"
                  appearance="outlined"
                  tabindex="0"
                  role="link"
                  [attr.aria-label]="'Go to repository ' + repo.name"
                >
                  <mat-card-header>
                    <mat-card-title>{{ repo.name }}</mat-card-title>
                    <mat-card-subtitle>{{ repo.full_name }}</mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content>
                    <p class="view-link" i18n="@@openEditorLink">Open Editor →</p>
                  </mat-card-content>
                </mat-card>
              }
            </div>
          }
        </div>
      } @else {
        <mat-card appearance="outlined">
          <mat-card-content>
            <p i18n="@@organizationNotFound">Organization not found.</p>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styleUrl: './organization.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly storage = inject(StorageService);
  private readonly fb = inject(FormBuilder);

  /** The ID of the currently viewed organization. */
  readonly organizationId = signal<string | null>(null);

  /** Computed property representing the current organization. */
  readonly organization = computed(() => {
    const id = this.organizationId();
    return this.storage.organizations().find((p) => p.id === id) || null;
  });

  /** Computed property representing the repositories for the current organization. */
  readonly repositories = computed(() => {
    const id = this.organizationId();
    if (!id) return [];
    return this.storage.getOrganizationRepositories(id);
  });

  /** Form group for repository creation. */
  repositoryForm = this.fb.group({
    name: ['', Validators.required],
  });

  /**
   * Initializes the component and subscribes to route parameters.
   */
  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.organizationId.set(params.get('id'));
    });
  }

  /**
   * Handles the repository creation form submission.
   */
  onCreateRepository(): void {
    const id = this.organizationId();
    if (id && this.repositoryForm.valid && this.repositoryForm.value.name) {
      this.storage.createRepository(id, this.repositoryForm.value.name);
      this.repositoryForm.reset();
    }
  }
}
