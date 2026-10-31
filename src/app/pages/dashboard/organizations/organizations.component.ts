/**
 * Dashboard organizations management page component.
 * @module app/pages/dashboard/organizations/organizations.component
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { GLOBAL_DATE } from '../../../tokens';
import { ApiService } from '../../../services/api.service';
import { BackendConfigService } from '../../../services/backend-config.service';
import { OrgRole } from '../../../models/types';

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
 * Component to manage user organizations, including creation, GitHub synchronization, deletion, and inviting members.
 */
@Component({
  selector: 'app-organizations',
  imports: [ReactiveFormsModule, A11yModule, MatButtonModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <h1 i18n="@@organizationsTitle">Organizations</h1>
        <div class="header-btns">
          <button
            type="button"
            mat-stroked-button
            class="btn btn-secondary sync-github-btn"
            (click)="onSyncGithub()"
            i18n="@@syncGithubOrgsBtn"
          >
            Sync with GitHub
          </button>
          <button
            type="button"
            mat-flat-button
            class="btn btn-primary"
            (click)="toggleCreateForm()"
          >
            @if (showCreateForm()) {
              <span i18n="@@cancelBtn">Cancel</span>
            } @else {
              <span i18n="@@createOrgBtn">Create Organization</span>
            }
          </button>
        </div>
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
        <div class="card create-org-card">
          <h2 i18n="@@createNewOrgHeading">Create New Organization</h2>
          <form [formGroup]="createOrgForm" (ngSubmit)="onCreateOrg()">
            <div class="form-group">
              <label for="orgName" i18n="@@orgNameLabel">Organization Name</label>
              <input
                type="text"
                id="orgName"
                formControlName="name"
                class="form-control"
                placeholder="e.g. Acme Corp"
                i18n-placeholder="@@orgNamePlaceholder"
                [attr.aria-invalid]="
                  createOrgForm.get('name')?.invalid && createOrgForm.get('name')?.touched
                    ? 'true'
                    : null
                "
                [attr.aria-describedby]="
                  createOrgForm.get('name')?.invalid && createOrgForm.get('name')?.touched
                    ? 'orgNameError'
                    : null
                "
              />
              @if (createOrgForm.get('name')?.invalid && createOrgForm.get('name')?.touched) {
                <span id="orgNameError" class="error-text" role="alert" i18n="@@orgNameRequiredErr">
                  Organization name is required.
                </span>
              }
            </div>
            <button
              type="submit"
              mat-flat-button
              class="btn btn-primary"
              [disabled]="createOrgForm.invalid"
              i18n="@@createSubmitBtn"
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
              <span i18n="@@orgMembersCount">{{ org.members }} Members</span>
            </div>
            <div class="org-actions">
              <button
                type="button"
                mat-stroked-button
                class="btn btn-secondary"
                (click)="openInvite(org)"
                i18n="@@inviteUsersBtn"
              >
                Invite Users
              </button>
              <button
                type="button"
                mat-stroked-button
                class="btn btn-secondary delete-org-btn"
                aria-label="Delete organization"
                (click)="onDeleteOrg(org)"
                i18n="@@deleteOrgBtn"
              >
                Delete Organization
              </button>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <p i18n="@@noOrganizationsMsg">You don't belong to any organizations yet.</p>
          </div>
        }
      </div>

      @if (selectedOrgForInvite(); as selectedOrg) {
        <div
          class="modal-backdrop"
          (click)="closeInvite()"
          (keydown.escape)="closeInvite()"
          tabindex="-1"
        >
          <div
            class="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-dialog-title"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h2 id="invite-dialog-title" i18n="@@inviteDialogTitle">
              Invite to {{ selectedOrg.name }}
            </h2>
            <form [formGroup]="inviteForm" (ngSubmit)="onInvite()">
              <div class="form-group">
                <label for="email" i18n="@@userEmailLabel">User Email</label>
                <input
                  type="email"
                  id="email"
                  formControlName="email"
                  class="form-control"
                  placeholder="user@example.com"
                  i18n-placeholder="@@userEmailPlaceholder"
                />
              </div>
              <div class="form-group">
                <label for="role" i18n="@@userRoleLabel">Role</label>
                <select id="role" formControlName="role" class="form-control">
                  <option value="Admin" i18n="@@roleAdminOption">Admin</option>
                  <option value="Member" i18n="@@roleMemberOption">Member</option>
                </select>
              </div>
              <div class="modal-actions">
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary"
                  (click)="closeInvite()"
                  i18n="@@cancelModalBtn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  mat-flat-button
                  class="btn btn-primary"
                  [disabled]="inviteForm.invalid"
                  i18n="@@sendInviteBtn"
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
    .header-btns {
      display: flex;
      gap: 0.75rem;
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
        outline: 2px solid var(--primary-color);
        outline-offset: 1px;
        border-color: var(--primary-color);
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
export class OrganizationsComponent implements OnInit {
  /** Global Date constructor. */
  private readonly globalDate = inject(GLOBAL_DATE);
  /** Backend API service. */
  private readonly api = inject(ApiService);
  /** Backend configuration service. */
  private readonly config = inject(BackendConfigService);

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

  /** Status message signal for backend actions. */
  readonly statusMessage = signal<string | null>(null);
  /** Error message signal for backend actions. */
  readonly errorMessage = signal<string | null>(null);

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
   * Initializes the component and fetches organizations from the backend when online.
   */
  ngOnInit(): void {
    if (this.config.isOnline()) {
      this.loadOrganizations();
    }
  }

  /**
   * Loads organizations from `GET /api/v1/orgs`.
   */
  loadOrganizations(): void {
    this.api.listOrgs().subscribe({
      next: (remoteOrgs) => {
        this.organizations.set(
          remoteOrgs.map((o) => ({
            id: String(o.id),
            name: o.name || o.login,
            role:
              o.role === 'admin' || o.role === 'Admin'
                ? 'Admin'
                : o.role === 'member' || o.role === 'Member'
                  ? 'Member'
                  : 'Owner',
            members: o.members ?? 1,
          })),
        );
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
      this.createOrgForm.reset();
    }
  }

  /**
   * Handles creating a new organization
   */
  onCreateOrg(): void {
    if (this.createOrgForm.valid) {
      const orgName = this.createOrgForm.value.name || '';
      if (this.config.isOnline()) {
        this.api.createOrg({ login: orgName }).subscribe({
          next: (created) => {
            const newOrg: Organization = {
              id: String(created.id),
              name: created.name || created.login,
              role: 'Owner',
              members: created.members ?? 1,
            };
            this.organizations.update((orgs) => [...orgs, newOrg]);
            this.errorMessage.set(null);
            this.toggleCreateForm();
          },
          error: () => {
            this.errorMessage.set('Failed to create organization on backend.');
          },
        });
        return;
      }

      const newOrg: Organization = {
        id: `org-${this.globalDate.now()}`,
        name: orgName,
        role: 'Owner',
        members: 1,
      };
      this.organizations.update((orgs) => [...orgs, newOrg]);
      this.toggleCreateForm();
    }
  }

  /**
   * Deletes an organization on the backend (when online) and removes it from the list.
   * @param org The organization to delete.
   */
  onDeleteOrg(org: Organization): void {
    if (this.config.isOnline()) {
      this.api.deleteOrg(org.id).subscribe({
        next: () => {
          this.organizations.update((orgs) => orgs.filter((o) => o.id !== org.id));
          this.statusMessage.set(`Deleted organization ${org.name}.`);
          this.errorMessage.set(null);
        },
        error: () => {
          this.errorMessage.set(`Failed to delete organization ${org.name}.`);
        },
      });
      return;
    }
    this.organizations.update((orgs) => orgs.filter((o) => o.id !== org.id));
  }

  /**
   * Triggers GitHub organization and repository synchronization (`POST /github/sync`).
   */
  onSyncGithub(): void {
    if (!this.config.isOnline()) {
      this.statusMessage.set('GitHub synchronization requires Online Mode.');
      return;
    }
    this.api.syncGithub().subscribe({
      next: (res) => {
        this.statusMessage.set(res.message || 'Synchronized with GitHub.');
        this.errorMessage.set(null);
        this.loadOrganizations();
      },
      error: () => {
        this.errorMessage.set('Failed to synchronize with GitHub.');
      },
    });
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
      const org = this.selectedOrgForInvite();
      if (org) {
        const email = this.inviteForm.value.email || '';
        const role = (this.inviteForm.value.role || 'Member').toLowerCase() as OrgRole;
        if (this.config.isOnline()) {
          this.api.inviteOrgMember(org.id, { email, role }).subscribe({
            next: () => {
              this.organizations.update((orgs) =>
                orgs.map((o) => (o.id === org.id ? { ...o, members: o.members + 1 } : o)),
              );
              this.closeInvite();
            },
            error: () => {
              this.errorMessage.set('Failed to send organization invitation.');
            },
          });
          return;
        }

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
