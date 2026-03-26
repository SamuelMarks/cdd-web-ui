import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LoggingService } from '../../services/logging.service';
import { VisualisationsComponent } from '../visualisations/visualisations.component';

@Component({
  selector: 'app-bottom-panel',
  imports: [CommonModule, MatTabsModule, MatIconModule, MatButtonModule, VisualisationsComponent],
  template: `
    <div class="bottom-panel-container">
      <mat-tab-group class="bottom-panel-tabs">
        <mat-tab label="Console">
          <div class="console-tab-content">
            <div class="console-toolbar">
              <button mat-icon-button title="Clear Console" (click)="clearLogs()">
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
        <mat-tab label="Visualisations">
          <app-visualisations></app-visualisations>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styleUrl: './bottom-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomPanelComponent {
  private loggingService = inject(LoggingService);
  logs = this.loggingService.logs;

  clearLogs(): void {
    this.loggingService.clear();
  }
}
