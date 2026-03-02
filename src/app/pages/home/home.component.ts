import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StorageService } from '../../services/storage.service';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

/**
 * Component for the dashboard landing page.
 */
@Component({
  selector: 'app-home',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  template: `
    <div class="container">
      @if (!storage.user()) {
        <mat-card class="create-user-card" appearance="outlined">
          <mat-card-header>
            <mat-card-title i18n="@@welcomeDashboardTitle">CDD Dashboard</mat-card-title>
            <mat-card-subtitle i18n="@@welcomeDashboardSubtitle"
              >Create a user to save your repositories and API specifications.</mat-card-subtitle
            >
          </mat-card-header>

          <mat-card-content>
            <form [formGroup]="userForm" (ngSubmit)="onCreateUser()" class="user-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label i18n="@@userNameLabel">Username / Login</mat-label>
                <input
                  matInput
                  formControlName="login"
                  placeholder="e.g. octocat"
                  i18n-placeholder="@@userNamePlaceholder"
                  aria-label="Enter your username"
                />
                @if (userForm.get('login')?.hasError('required')) {
                  <mat-error i18n="@@userNameRequiredError">Username is required</mat-error>
                }
              </mat-form-field>

              <button
                mat-flat-button
                color="primary"
                type="submit"
                [disabled]="userForm.invalid"
                class="full-width"
                i18n="@@createUserBtn"
                aria-label="Create new user"
              >
                Create User
              </button>
            </form>
          </mat-card-content>
        </mat-card>
      } @else {
        <div class="dashboard">
          <header class="dashboard-header">
            <h2 i18n="@@welcomeUser">Welcome, {{ storage.user()?.login }}!</h2>
          </header>

          <div class="organizations-section">
            <h3 i18n="@@yourOrganizationsHeading">Your Organizations</h3>

            <mat-card class="create-organization" appearance="outlined">
              <mat-card-content>
                <h4 i18n="@@createNewOrganizationHeading">Create New Organization</h4>
                <form
                  [formGroup]="organizationForm"
                  (ngSubmit)="onCreateOrganization()"
                  class="inline-form"
                >
                  <mat-form-field appearance="outline" class="flex-field" subscriptSizing="dynamic">
                    <mat-label i18n="@@organizationNameLabel">Organization Name</mat-label>
                    <input
                      matInput
                      formControlName="login"
                      placeholder="e.g. acmecorp"
                      i18n-placeholder="@@organizationNamePlaceholder"
                      aria-label="Enter organization name"
                    />
                  </mat-form-field>
                  <button
                    mat-flat-button
                    color="primary"
                    type="submit"
                    [disabled]="organizationForm.invalid"
                    i18n="@@createOrganizationBtn"
                    aria-label="Create Organization"
                  >
                    Create Organization
                  </button>
                </form>
              </mat-card-content>
            </mat-card>

            <div class="organizations-list">
              @if (storage.organizations().length === 0) {
                <div class="empty-state">
                  <p i18n="@@noOrganizationsYet">No organizations yet. Create one above.</p>
                </div>
              } @else {
                <div class="grid">
                  @for (org of storage.organizations(); track org.id) {
                    <mat-card
                      class="org-card hoverable"
                      [routerLink]="['/organization', org.id]"
                      appearance="outlined"
                      tabindex="0"
                      (keydown.enter)="navigateToOrganization(org.id)"
                    >
                      <mat-card-header>
                        <mat-card-title>{{ org.login }}</mat-card-title>
                      </mat-card-header>
                      <mat-card-content>
                        <p class="view-link" i18n="@@viewRepositoriesLink">View Repositories →</p>
                      </mat-card-content>
                    </mat-card>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  /** The storage service for accessing user data. */
  readonly storage = inject(StorageService);
  private readonly fb = inject(FormBuilder);

  /** Form group for user creation. */
  userForm = this.fb.group({
    login: ['', Validators.required],
  });

  /** Form group for organization creation. */
  organizationForm = this.fb.group({
    login: ['', Validators.required],
  });

  /**
   * Handles the user creation form submission.
   */
  onCreateUser(): void {
    if (this.userForm.valid && this.userForm.value.login) {
      this.storage.createUser(this.userForm.value.login);
      this.userForm.reset();
    }
  }

  /**
   * Handles the organization creation form submission.
   */
  onCreateOrganization(): void {
    if (this.organizationForm.valid && this.organizationForm.value.login) {
      this.storage.createOrganization(this.organizationForm.value.login);
      this.organizationForm.reset();
    }
  }

  /**
   * Navigates to the selected organization.
   * @param id The ID of the organization to navigate to.
   */
  navigateToOrganization(id: string): void {
    // handled natively by routerLink on the card, but useful for keydown.enter
    // To strictly follow best practices, if we have routerLink, we might just let it handle it.
  }
}
