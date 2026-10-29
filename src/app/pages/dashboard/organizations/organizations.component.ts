/**
 * Dashboard organizations management page component.
 * @module app/pages/dashboard/organizations/organizations.component
 */
import { Component, signal, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { GLOBAL_DATE } from '../../../tokens';

/**
 * Represents an organization containing members and roles.
 */
interface Organization {
  /** The unique identifier of the organization */
  id: string;
  /** The name of the organization */
  name: string;
  /** The role of the user within this organization */
  role: 'Owner' | 'Admin' | 'Member';
  /** The total count of members in the organization */
  members: number;
}

/**
 * Component to manage user organizations, including creation and inviting members.
 */
@Component({
  selector: 'app-organizations',
  imports: [ReactiveFormsModule, A11yModule, MatButtonModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <h1>Organizations</h1>
        <button type="button" mat-flat-button class="btn btn-primary" (click)="toggleCreateForm()">
          {{ showCreateForm() ? 'Cancel' : 'Create Organization' }}
        </button>
      </div>

      @if (showCreateForm()) {
        <div class="card create-org-card">
          <h2>Create New Organization</h2>
          <form [formGroup]="createOrgForm" (ngSubmit)="onCreateOrg()">
            <div class="form-group">
              <label for="orgName">Organization Name</label>
              <input
                type="text"
                id="orgName"
                formControlName="name"
                class="form-control"
                placeholder="e.g. Acme Corp"
                aria-describedby="orgNameError"
              />
              @if (createOrgForm.get('name')?.invalid && createOrgForm.get('name')?.touched) {
                <span id="orgNameError" class="error-text" role="alert">
                  Organization name is required.
                </span>
              }
            </div>
            <button
              type="submit"
              mat-flat-button
              class="btn btn-primary"
              [disabled]="createOrgForm.invalid"
            >
              Create
            </button>
          </form>
        </div>
      }

      <div class="org-list">
        @for (org of organizations(); track org.id) {
          <div class="card org-card">
            <div class="org-info">
              <h3>{{ org.name }}</h3>
              <span class="badge">{{ org.role }}</span>
            </div>
            <div class="org-stats">
              <span>{{ org.members }} Members</span>
            </div>
            <div class="org-actions">
              <button
                type="button"
                mat-stroked-button
                class="btn btn-secondary"
                (click)="openInvite(org)"
              >
                Invite Users
              </button>
              <button type="button" mat-stroked-button class="btn btn-secondary">Settings</button>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <p>You don't belong to any organizations yet.</p>
          </div>
        }
      </div>

      @if (selectedOrgForInvite(); as selectedOrg) {
        <div class="modal-backdrop" (keydown.escape)="closeInvite()">
          <div
            class="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-dialog-title"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
          >
            <h2 id="invite-dialog-title">Invite to {{ selectedOrg.name }}</h2>
            <form [formGroup]="inviteForm" (ngSubmit)="onInvite()">
              <div class="form-group">
                <label for="email">User Email</label>
                <input
                  type="email"
                  id="email"
                  formControlName="email"
                  class="form-control"
                  placeholder="user@example.com"
                />
              </div>
              <div class="form-group">
                <label for="role">Role</label>
                <select id="role" formControlName="role" class="form-control">
                  <option value="Admin">Admin</option>
                  <option value="Member">Member</option>
                </select>
              </div>
              <div class="modal-actions">
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary"
                  (click)="closeInvite()"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  mat-flat-button
                  class="btn btn-primary"
                  [disabled]="inviteForm.invalid"
                >
                  Send Invite
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
    .card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    .create-org-card {
      margin-bottom: 2rem;
      h2 {
        margin-top: 0;
        font-size: 1.25rem;
      }
    }
    .org-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .org-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      h3 {
        margin: 0;
        font-size: 1.125rem;
      }
    }
    .badge {
      background: var(--primary-hover);
      color: var(--primary-color);
      padding: 0.25rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .org-stats {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
    .org-actions {
      display: flex;
      gap: 0.5rem;
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
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
      }
    }
    .error-text {
      color: var(--error-text);
      font-size: 0.75rem;
      display: block;
      margin-top: 0.25rem;
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
      max-width: 400px;
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
 * Component to manage user organizations, including creation and inviting members.
 */
export class OrganizationsComponent {
  /** Global Date constructor. */
  private readonly globalDate = inject(GLOBAL_DATE);

  /**
   * List of organizations
   */
  organizations = signal<Organization[]>([
    { id: 'org-1', name: 'Offscale', role: 'Owner', members: 5 },
    { id: 'org-2', name: 'Demo Team', role: 'Admin', members: 12 },
  ]);

  /**
   * Whether the create form is visible
   */
  showCreateForm = signal(false);

  /**
   * Organization selected for inviting users
   */
  selectedOrgForInvite = signal<Organization | null>(null);

  /**
   * Form group for creating a new organization
   */
  createOrgForm = new FormGroup({
    name: new FormControl('', Validators.required),
  });

  /**
   * Form group for inviting users
   */
  inviteForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    role: new FormControl('Member', Validators.required),
  });

  /**
   * Toggles the visibility of the create form
   */
  toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
    if (!this.showCreateForm()) {
      this.createOrgForm.reset();
    }
  }

  /**
   * Handles creating a new organization
   */
  onCreateOrg(): void {
    if (this.createOrgForm.valid) {
      const newOrg: Organization = {
        id: `org-${this.globalDate.now()}`,
        name: this.createOrgForm.value.name || '',
        role: 'Owner',
        members: 1,
      };
      this.organizations.update((orgs) => [...orgs, newOrg]);
      this.toggleCreateForm();
    }
  }

  /**
   * Opens the invite modal for a specific organization
   * @param org The organization to invite to
   */
  openInvite(org: Organization): void {
    this.selectedOrgForInvite.set(org);
    this.inviteForm.reset({ role: 'Member' });
  }

  /**
   * Closes the invite modal
   */
  closeInvite(): void {
    this.selectedOrgForInvite.set(null);
  }

  /**
   * Handles submitting the invite form
   */
  onInvite(): void {
    if (this.inviteForm.valid) {
      // In a real app, send API request here
      const org = this.selectedOrgForInvite();
      if (org) {
        this.organizations.update((orgs) =>
          orgs.map((o) => {
            if (o.id === org.id) {
              return { ...o, members: o.members + 1 };
            }
            return o;
          }),
        );
      }
      this.closeInvite();
    }
  }
}
