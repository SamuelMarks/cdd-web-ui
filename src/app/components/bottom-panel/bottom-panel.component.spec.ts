
import { of } from "rxjs";
import { TestBed, ComponentFixture } from "@angular/core/testing";
import { BottomPanelComponent } from "./bottom-panel.component";
import { LoggingService, LogEntry } from "../../services/logging.service";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { signal, Component } from "@angular/core";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { provideMockActions } from "@ngrx/effects/testing";
import { provideMockStore } from "@ngrx/store/testing";
import { VisualisationsComponent } from "../visualisations/visualisations.component";
import { ApiDocsViewerComponent } from "../api-docs-viewer/api-docs-viewer.component";

@Component({ selector: "app-visualisations", template: "" })
class MockVisualisationsComponent {}

@Component({ selector: "app-api-docs-viewer", template: "" })
class MockApiDocsViewerComponent {}

describe("BottomPanelComponent", () => {
  let component: BottomPanelComponent;
  let fixture: ComponentFixture<BottomPanelComponent>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  let loggingServiceMock: { logs: unknown, clear: unknown };

  beforeEach(async () => {
    loggingServiceMock = {
      logs: signal<LogEntry[]>([{ level: "INFO", message: "Test log", timestamp: new Date().toISOString() }]),
      clear: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BottomPanelComponent, NoopAnimationsModule],
      providers: [
        { provide: LoggingService, useValue: loggingServiceMock },
        provideMockActions(() => of()),
        provideMockStore()
      ]
    })
    .overrideComponent(BottomPanelComponent, {
      remove: { imports: [VisualisationsComponent, ApiDocsViewerComponent] },
      add: { imports: [MockVisualisationsComponent, MockApiDocsViewerComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(BottomPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should call clearLogs when clear button is clicked", () => {
    component.clearLogs();
    expect(loggingServiceMock.clear).toHaveBeenCalled();
  });
});
