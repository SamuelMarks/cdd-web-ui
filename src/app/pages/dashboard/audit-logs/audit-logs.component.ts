/**
 * Dashboard audit logs page component displaying SDK generation and publishing history.
 * @module app/pages/dashboard/audit-logs/audit-logs.component
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { GLOBAL_DATE } from '../../../tokens';
import { ApiService } from '../../../services/api.service';
import { BackendConfigService } from '../../../services/backend-config.service';
import { AuditLogRecord } from '../../../models/types';

/**
 * Interface representing an audit event.
 */
export interface AuditEvent {
  /** Unique identifier for the audit event. */
  id: string;
  /** The timestamp when the event occurred. */
  timestamp: Date;
  /** The action performed (Generation or Publishing). */
  action: 'Generation' | 'Publishing';
  /** The repository associated with the event. */
  repository: string;
  /** The language of the SDK. */
  language: string;
  /** The status of the event. */
  status: 'Success' | 'Failed' | 'In Progress';
  /** An optional error message if the event failed. */
  errorMessage?: string;
  /** The duration of the event in milliseconds. */
  durationMs: number;
}

/**
 * Component for displaying audit logs.
 */
@Component({
  selector: 'app-audit-logs',
  imports: [DatePipe, A11yModule, MatButtonModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <div>
          <h1 i18n="@@auditLogsTitle">Audit Logs</h1>
          <p class="subtitle" i18n="@@auditLogsSubtitle">
            History of SDK generation and publishing events.
          </p>
        </div>

        <div class="filter-bar">
          <label for="auditOrgSelect" class="sr-only" i18n="@@auditOrgSelectLabel"
            >Organization</label
          >
          <select
            id="auditOrgSelect"
            class="org-select"
            [value]="selectedOrgId()"
            (change)="onOrgChange($event)"
            aria-label="Select organization for audit logs"
          >
            @for (org of organizations(); track org.id) {
              <option [value]="org.id">{{ org.name }}</option>
            }
          </select>

          <button
            type="button"
            mat-stroked-button
            class="btn btn-secondary"
            (click)="refreshLogs()"
            i18n="@@refreshAuditLogsBtn"
          >
            Refresh
          </button>
        </div>
      </div>

      @if (errorMessage()) {
        <div class="error-banner" role="alert">
          {{ errorMessage() }}
        </div>
      }

      <div class="card">
        <div class="table-responsive">
          <table class="table" aria-label="Audit Logs" i18n-aria-label="@@auditLogsTableAria">
            <thead>
              <tr>
                <th scope="col" i18n="@@colTimestamp">Timestamp</th>
                <th scope="col" i18n="@@colAction">Action</th>
                <th scope="col" i18n="@@colRepository">Repository</th>
                <th scope="col" i18n="@@colLanguage">Language</th>
                <th scope="col" i18n="@@colStatus">Status</th>
                <th scope="col" i18n="@@colDuration">Duration</th>
                <th scope="col" i18n="@@colDetails">Details</th>
              </tr>
            </thead>
            <tbody>
              @for (event of logs(); track event.id) {
                <tr [class.row-failed]="event.status === 'Failed'">
                  <td class="col-time">{{ event.timestamp | date: 'medium' }}</td>
                  <td>
                    <span
                      class="badge action-badge"
                      [class.action-gen]="event.action === 'Generation'"
                      [class.action-pub]="event.action === 'Publishing'"
                    >
                      {{ event.action }}
                    </span>
                  </td>
                  <td class="col-repo">{{ event.repository }}</td>
                  <td>{{ event.language }}</td>
                  <td>
                    <span
                      class="status-badge"
                      [class.status-success]="event.status === 'Success'"
                      [class.status-failed]="event.status === 'Failed'"
                      [class.status-progress]="event.status === 'In Progress'"
                    >
                      {{ event.status }}
                    </span>
                  </td>
                  <td>{{ (event.durationMs / 1000).toFixed(1) }}s</td>
                  <td>
                    @if (event.status === 'Failed' && event.errorMessage) {
                      <button
                        type="button"
                        class="btn btn-sm btn-error"
                        (click)="viewError(event)"
                        i18n="@@viewErrorBtn"
                      >
                        View Error
                      </button>
                    } @else {
                      <span class="text-muted">-</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-state" i18n="@@noAuditLogsMsg">
                    No audit logs found.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pagination-bar">
          <button
            type="button"
            mat-stroked-button
            class="btn btn-sm btn-secondary"
            [disabled]="offset() === 0"
            (click)="prevPage()"
            i18n="@@auditPrevPageBtn"
          >
            Previous
          </button>
          <span class="page-info" i18n="@@auditPageInfo">
            Offset {{ offset() }} (Limit {{ limit() }})
          </span>
          <button
            type="button"
            mat-stroked-button
            class="btn btn-sm btn-secondary"
            (click)="nextPage()"
            i18n="@@auditNextPageBtn"
          >
            Next
          </button>
        </div>
      </div>

      <!-- Error Modal -->
      @if (selectedEventError(); as selectedError) {
        <div
          class="modal-backdrop"
          (click)="closeError()"
          (keydown.escape)="closeError()"
          tabindex="-1"
        >
          <div
            class="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-error-dialog-title"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h2 id="audit-error-dialog-title" i18n="@@errorDetailsDialogTitle">Error Details</h2>
            <div class="error-details">
              <p i18n="@@errorEventSummary">
                <strong>Event:</strong> {{ selectedError.action }} for
                {{ selectedError.repository }} ({{ selectedError.language }})
              </p>
              <p i18n="@@errorTimeSummary">
                <strong>Time:</strong>
                {{ selectedError.timestamp | date: 'medium' }}
              </p>

              <div class="error-box">
                <pre><code>{{ selectedError.errorMessage }}</code></pre>
              </div>
            </div>

            <div class="modal-actions">
              <button
                type="button"
                mat-stroked-button
                class="btn btn-secondary"
                (click)="closeError()"
                i18n="@@closeErrorBtn"
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
      max-width: 1200px;
      margin: 0 auto;
    }
    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 2rem;
      h1 {
        margin: 0 0 0.5rem 0;
        color: var(--text-primary);
      }
      .subtitle {
        margin: 0;
        color: var(--text-secondary);
        font-size: 1rem;
      }
    }
    .filter-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .org-select {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--surface-color);
      color: var(--text-primary);
      font-size: 0.875rem;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
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
      overflow: hidden;
    }
    .table-responsive {
      overflow-x: auto;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;

      th,
      td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
      }

      th {
        background-color: var(--bg-color);
        font-weight: 600;
        color: var(--text-secondary);
      }

      tbody tr:last-child td {
        border-bottom: none;
      }

      tbody tr:hover {
        background-color: var(--bg-color);
      }

      .row-failed {
        background-color: color-mix(in srgb, var(--error-bg) 30%, transparent);
      }
    }
    .col-time {
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .col-repo {
      font-family: monospace;
      font-size: 0.8125rem;
    }

    .badge {
      padding: 0.25rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .action-badge {
      &.action-gen {
        background: var(--primary-hover);
        color: var(--mat-sys-on-primary-container, var(--primary-color));
      }
      &.action-pub {
        background: var(--mat-sys-tertiary-container, var(--primary-hover));
        color: var(--mat-sys-on-tertiary-container, var(--primary-color));
      }
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 600;

      &.status-success {
        background: var(--primary-hover);
        color: var(--mat-sys-on-primary-container, var(--primary-color));
      }
      &.status-failed {
        background: var(--error-bg);
        color: var(--error-text);
      }
      &.status-progress {
        background: var(--mat-sys-secondary-container, var(--bg-color));
        color: var(--mat-sys-on-secondary-container, var(--text-primary));
      }
    }
    .text-muted {
      color: var(--text-secondary);
    }

    .pagination-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--border-color);
      background: var(--bg-color);
    }
    .page-info {
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .btn {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      font-size: 0.875rem;
    }
    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
    .btn-error {
      background-color: var(--surface-color);
      color: var(--error-text);
      border-color: var(--border-color);
      &:hover {
        background-color: var(--error-bg);
        border-color: var(--error-text);
      }
    }
    .btn-secondary {
      background-color: var(--bg-color);
      color: var(--text-primary);
      border-color: var(--border-color);
      &:hover {
        background-color: var(--surface-color);
      }
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }

    /* Modal Styles */
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
      max-width: 600px;
      padding: 1.5rem;
      h2 {
        margin-top: 0;
        color: var(--error-text);
      }
    }
    .error-details {
      margin-top: 1rem;
      p {
        margin: 0 0 0.5rem;
        font-size: 0.875rem;
      }
    }
    .error-box {
      margin-top: 1rem;
      background-color: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
      pre {
        margin: 0;
      }
      code {
        font-family: monospace;
        font-size: 0.8125rem;
        color: var(--error-text);
      }
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }
  `,
})
export class AuditLogsComponent implements OnInit {
  /** Global Date constructor. */
  private readonly globalDate = inject(GLOBAL_DATE);
  /** Backend API service. */
  private readonly api = inject(ApiService);
  /** Backend configuration service. */
  private readonly config = inject(BackendConfigService);

  /** Available organizations for filtering audit logs. */
  readonly organizations = signal<
    {
      /** Numeric organization ID. */
      id: number;
      /** Display name of the organization. */
      name: string;
    }[]
  >([
    { id: 1, name: 'Offscale' },
    { id: 2, name: 'Demo Team' },
  ]);

  /** Currently selected organization ID. */
  readonly selectedOrgId = signal<number>(1);
  /** Pagination page size (`1..=100`). */
  readonly limit = signal<number>(25);
  /** Pagination offset (`>= 0`). */
  readonly offset = signal<number>(0);
  /** Error message signal if loading audit logs fails. */
  readonly errorMessage = signal<string | null>(null);

  /**
   * List of audit events
   */
  logs = signal<AuditEvent[]>([
    {
      id: 'evt-1',
      timestamp: new this.globalDate(this.globalDate.now() - 1000 * 60 * 5),
      action: 'Publishing',
      repository: 'offscale/cdd-ctl',
      language: 'TypeScript',
      status: 'Success',
      durationMs: 12400,
    },
    {
      id: 'evt-2',
      timestamp: new this.globalDate(this.globalDate.now() - 1000 * 60 * 6),
      action: 'Publishing',
      repository: 'offscale/cdd-ctl',
      language: 'Rust',
      status: 'Failed',
      errorMessage: `error: failed to publish to crates.io
Caused by:
  the remote server responded with an error: 403 Forbidden - invalid token`,
      durationMs: 4200,
    },
    {
      id: 'evt-3',
      timestamp: new this.globalDate(this.globalDate.now() - 1000 * 60 * 10),
      action: 'Generation',
      repository: 'offscale/cdd-ctl',
      language: 'Rust',
      status: 'Success',
      durationMs: 8100,
    },
    {
      id: 'evt-4',
      timestamp: new this.globalDate(this.globalDate.now() - 1000 * 60 * 10),
      action: 'Generation',
      repository: 'offscale/cdd-ctl',
      language: 'TypeScript',
      status: 'Success',
      durationMs: 3500,
    },
    {
      id: 'evt-5',
      timestamp: new this.globalDate(this.globalDate.now() - 1000 * 60 * 60 * 2),
      action: 'Generation',
      repository: 'demo/payment-service',
      language: 'Go',
      status: 'Failed',
      errorMessage:
        'OpenAPI parsing error at line 45: paths./payments.post.responses.200.content.application/json.schema.$ref: Could not resolve reference: #/components/schemas/PaymentResponse',
      durationMs: 1200,
    },
  ]);

  /**
   * Currently selected event to view error details
   */
  selectedEventError = signal<AuditEvent | null>(null);

  /**
   * Initializes the component and loads remote audit logs when online.
   */
  ngOnInit(): void {
    if (this.config.isOnline()) {
      this.loadOrganizationsAndLogs();
    }
  }

  /**
   * Loads organizations from `GET /api/v1/orgs` and then fetches audit logs for the selected organization.
   */
  loadOrganizationsAndLogs(): void {
    this.api.listOrgs().subscribe({
      next: (orgs) => {
        if (orgs.length > 0) {
          const mapped = orgs.map((o) => ({ id: Number(o.id), name: o.name || o.login }));
          this.organizations.set(mapped);
          this.selectedOrgId.set(mapped[0].id);
          this.refreshLogs();
        } else {
          this.organizations.set([]);
          this.logs.set([]);
          this.errorMessage.set(null);
        }
      },
      error: () => {
        this.refreshLogs();
      },
    });
  }

  /**
   * Fetches paginated audit logs (`GET /api/v1/orgs/{org_id}/audit`) when online.
   */
  refreshLogs(): void {
    if (!this.config.isOnline()) {
      return;
    }
    this.api
      .listAuditLogs(this.selectedOrgId(), {
        limit: this.limit(),
        offset: this.offset(),
      })
      .subscribe({
        next: (records) => {
          this.logs.set(records.map((rec) => this.mapRecordToEvent(rec)));
          this.errorMessage.set(null);
        },
        error: () => {
          this.errorMessage.set('Failed to load audit logs from backend.');
        },
      });
  }

  /**
   * Maps a backend `AuditLogRecord` into a display `AuditEvent`.
   * @param rec The raw audit log record from `cdd-control-plane`.
   * @returns The mapped `AuditEvent`.
   */
  mapRecordToEvent(rec: AuditLogRecord): AuditEvent {
    const meta = rec.metadata_json ?? {};
    const isPublish =
      rec.action === 'release_created' ||
      rec.action === 'sdk_published' ||
      rec.action.includes('publish');
    const repo =
      typeof meta['repository'] === 'string'
        ? meta['repository']
        : rec.repo_id !== null
          ? `repo-${rec.repo_id}`
          : `org-${rec.org_id}`;
    const language = typeof meta['language'] === 'string' ? meta['language'] : 'All';
    const errorMsg =
      typeof meta['error'] === 'string'
        ? meta['error']
        : typeof meta['error_message'] === 'string'
          ? meta['error_message']
          : undefined;
    const status = errorMsg || rec.action === 'publish_failed' ? 'Failed' : 'Success';
    const durationMs = typeof meta['durationMs'] === 'number' ? meta['durationMs'] : 1000;

    return {
      id: String(rec.id),
      timestamp: new this.globalDate(rec.timestamp),
      action: isPublish ? 'Publishing' : 'Generation',
      repository: repo,
      language,
      status,
      errorMessage: errorMsg,
      durationMs,
    };
  }

  /**
   * Handles changing the selected organization in the dropdown.
   * @param event DOM change event from the select element.
   */
  onOrgChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedOrgId.set(Number(target.value) || 1);
    this.offset.set(0);
    this.refreshLogs();
  }

  /**
   * Advances pagination to the next page of audit logs.
   */
  nextPage(): void {
    this.offset.update((o) => o + this.limit());
    this.refreshLogs();
  }

  /**
   * Moves pagination to the previous page of audit logs.
   */
  prevPage(): void {
    this.offset.update((o) => Math.max(0, o - this.limit()));
    this.refreshLogs();
  }

  /**
   * Opens the error view for a specific audit event
   * @param event The event to view
   */
  viewError(event: AuditEvent): void {
    this.selectedEventError.set(event);
  }

  /**
   * Closes the error view
   */
  closeError(): void {
    this.selectedEventError.set(null);
  }
}
