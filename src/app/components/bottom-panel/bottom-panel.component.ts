import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LoggingService } from '../../services/logging.service';
import { VisualisationsComponent } from '../visualisations/visualisations.component';
import { ApiDocsViewerComponent } from '../api-docs-viewer/api-docs-viewer.component';
import { Actions, ofType } from '@ngrx/effects';
import * as WorkspaceActions from '../../store/actions';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-bottom-panel',
  imports: [CommonModule, MatTabsModule, MatIconModule, MatButtonModule, VisualisationsComponent, ApiDocsViewerComponent],
  template: `
    <div class="bottom-panel-container">
      <mat-tab-group class="bottom-panel-tabs" [selectedIndex]="selectedTabIndex()" (selectedIndexChange)="selectedTabIndex.set($event)">
        <mat-tab label="Logs">
          <div class="console-tab-content">
            <div class="console-toolbar">
              <button mat-icon-button title="Clear Logs" (click)="clearLogs()">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
            <div class="console-content">
              @for (log of logs(); track log.timestamp + $index) {
                <div class="log-entry log-{{ log.level.toLowerCase() }}">
                  <span class="log-timestamp">[{{ log.timestamp | date:'HH:mm:ss.SSS' }}]</span>
                  <span class="log-level">{{ log.level }}</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
              } @empty {
                <div class="empty-state">No logs to display</div>
              }
            </div>
          </div>
        </mat-tab>
        <mat-tab label="Structure">
          <app-visualisations></app-visualisations>
        </mat-tab>
        <mat-tab label="Docs UI">
          <app-api-docs-viewer></app-api-docs-viewer>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styleUrl: './bottom-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomPanelComponent {
  private loggingService = inject(LoggingService);
  private actions$ = inject(Actions);

  logs = this.loggingService.logs;
  selectedTabIndex = signal(0);

  constructor() {
    this.actions$.pipe(
      ofType(WorkspaceActions.executeRunSuccess),
      takeUntilDestroyed()
    ).subscribe(() => {
      this.selectedTabIndex.set(2);
    });

    this.actions$.pipe(
      ofType(WorkspaceActions.executeRunFailure),
      takeUntilDestroyed()
    ).subscribe(() => {
      this.selectedTabIndex.set(0);
    });
  }

  clearLogs(): void {
    this.loggingService.clear();
  }
}
