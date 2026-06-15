import { Component, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

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
  imports: [DatePipe],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <h1>Audit Logs</h1>
        <p class="subtitle">History of SDK generation and publishing events.</p>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Repository</th>
                <th>Language</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              @for (event of logs(); track event.id) {
                <tr [class.row-failed]="event.status === 'Failed'">
                  <td class="col-time">{{ event.timestamp | date:'medium' }}</td>
                  <td>
                    <span class="badge action-badge" 
                          [class.action-gen]="event.action === 'Generation'"
                          [class.action-pub]="event.action === 'Publishing'">
                      {{ event.action }}
                    </span>
                  </td>
                  <td class="col-repo">{{ event.repository }}</td>
                  <td>{{ event.language }}</td>
                  <td>
                    <span class="status-badge" 
                          [class.status-success]="event.status === 'Success'"
                          [class.status-failed]="event.status === 'Failed'"
                          [class.status-progress]="event.status === 'In Progress'">
                      {{ event.status }}
                    </span>
                  </td>
                  <td>{{ (event.durationMs / 1000).toFixed(1) }}s</td>
                  <td>
                    @if (event.status === 'Failed' && event.errorMessage) {
                      <button class="btn btn-sm btn-error" (click)="viewError(event)">View Error</button>
                    } @else {
                      <span class="text-muted">-</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-state">No audit logs found.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Error Modal -->
      @if (selectedEventError()) {
        <div class="modal-backdrop">
          <div class="modal card">
            <h2>Error Details</h2>
            <div class="error-details">
              <p><strong>Event:</strong> {{ selectedEventError()?.action }} for {{ selectedEventError()?.repository }} ({{ selectedEventError()?.language }})</p>
              <p><strong>Time:</strong> {{ selectedEventError()?.timestamp | date:'medium' }}</p>
              
              <div class="error-box">
                <pre><code>{{ selectedEventError()?.errorMessage }}</code></pre>
              </div>
            </div>
            
            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="closeError()">Close</button>
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
      margin-bottom: 2rem;
      h1 { margin: 0 0 0.5rem 0; color: var(--color-text-default, #24292f); }
      .subtitle { margin: 0; color: var(--color-text-muted, #57606a); font-size: 1rem; }
    }
    .card {
      background: var(--color-bg-default, #ffffff);
      border: 1px solid var(--color-border-default, #d0d7de);
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
      
      th, td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border-default, #d0d7de);
      }
      
      th {
        background-color: var(--color-bg-subtle, #f6f8fa);
        font-weight: 600;
        color: var(--color-text-muted, #57606a);
      }

      tbody tr:last-child td {
        border-bottom: none;
      }
      
      tbody tr:hover {
        background-color: var(--color-bg-subtle, #f6f8fa);
      }
      
      .row-failed {
        background-color: #fff8c51a; /* slight yellow/red tint if desired */
      }
    }
    .col-time { color: var(--color-text-muted, #57606a); white-space: nowrap; }
    .col-repo { font-family: monospace; font-size: 0.8125rem; }
    
    .badge {
      padding: 0.25rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .action-badge {
      &.action-gen { background: #eef2ff; color: #4f46e5; }
      &.action-pub { background: #fdf4ff; color: #c026d3; }
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      
      &.status-success { background: #dcffe4; color: #1a7f37; }
      &.status-failed { background: #ffebe9; color: #cf222e; }
      &.status-progress { background: #ddf4ff; color: #0969da; }
    }
    .text-muted { color: var(--color-text-muted, #57606a); }
    
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
      background-color: #ffffff;
      color: #cf222e;
      border-color: #d0d7de;
      &:hover { background-color: #ffebe9; border-color: #cf222e; }
    }
    .btn-secondary {
      background-color: #f6f8fa;
      color: #24292f;
      border-color: rgba(27, 31, 36, 0.15);
      &:hover { background-color: #f3f4f6; }
    }

    .empty-state {
      text-align: center;
      padding: 3rem !important;
      color: var(--color-text-muted, #57606a);
    }

    /* Modal Styles */
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
      max-width: 600px;
      padding: 1.5rem;
      h2 { margin-top: 0; color: #cf222e; }
    }
    .error-details {
      margin-top: 1rem;
      p { margin: 0 0 0.5rem; font-size: 0.875rem; }
    }
    .error-box {
      margin-top: 1rem;
      background-color: #f6f8fa;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
      pre { margin: 0; }
      code { 
        font-family: monospace; 
        font-size: 0.8125rem; 
        color: #cf222e; 
        white-space: pre-wrap;
      }
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }
  `
})
export class AuditLogsComponent {
  /**
   * Mock data for audit logs
   */
  logs = signal<AuditEvent[]>([
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
      action: 'Publishing',
      repository: 'offscale/acme-api',
      language: 'TypeScript',
      status: 'Success',
      durationMs: 4500
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
      action: 'Generation',
      repository: 'offscale/acme-api',
      language: 'Rust',
      status: 'Failed',
      errorMessage: 'Error during AST generation: Schema reference "#/components/schemas/InvalidRef" not found.\n  at SchemaParser.resolveRefs (parser.js:142:9)\n  at CodeGen.generateModels (codegen.js:55:12)',
      durationMs: 1200
    },
    {
      id: 'log-3',
      timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      action: 'Publishing',
      repository: 'demo-team/core-services',
      language: 'Go',
      status: 'Failed',
      errorMessage: 'Authentication error: Invalid or expired registry token for index.golang.org.\nVerify your registry tokens in the Secrets & Releases settings.',
      durationMs: 3400
    },
    {
      id: 'log-4',
      timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      action: 'Generation',
      repository: 'demo-team/core-services',
      language: 'Go',
      status: 'Success',
      durationMs: 2800
    }
  ]);

  /**
   * Selected event for showing errors
   */
  selectedEventError = signal<AuditEvent | null>(null);

  /**
   * Sets the selected event error to view
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
