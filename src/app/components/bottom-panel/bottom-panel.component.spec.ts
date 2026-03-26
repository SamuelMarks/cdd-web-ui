/* eslint-disable @typescript-eslint/no-explicit-any */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BottomPanelComponent } from './bottom-panel.component';
import { LoggingService, LogEntry } from '../../services/logging.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Component } from '@angular/core';

import { VisualisationsComponent } from '../visualisations/visualisations.component';

@Component({ selector: 'app-visualisations', template: '' })
class MockVisualisationsComponent {}

describe('BottomPanelComponent', () => {
  let component: BottomPanelComponent;
  let fixture: ComponentFixture<BottomPanelComponent>;
  let loggingServiceMock: any;

  beforeEach(async () => {
    loggingServiceMock = {
      logs: signal<LogEntry[]>([{ level: 'INFO', message: 'Test log', timestamp: new Date().toISOString() }]),
      clear: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BottomPanelComponent, NoopAnimationsModule],
      providers: [
        { provide: LoggingService, useValue: loggingServiceMock }
      ]
    })
    .overrideComponent(BottomPanelComponent, {
      remove: { imports: [VisualisationsComponent] },
      add: { imports: [MockVisualisationsComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(BottomPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call clearLogs when clear button is clicked', () => {
    component.clearLogs();
    expect(loggingServiceMock.clear).toHaveBeenCalled();
  });
});
