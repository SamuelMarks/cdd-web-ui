
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ApiDocsViewerComponent } from "./api-docs-viewer.component";
import { provideMockStore, MockStore } from "@ngrx/store/testing";
import { AppState } from "../../store/state";
import {
  selectOpenApiSpecContent,
  selectGeneratedFiles
} from "../../store/selectors";
import * as WorkspaceActions from "../../store/actions";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ThemeService } from "../../services/theme.service";
import { signal } from "@angular/core";

describe("ApiDocsViewerComponent", () => {
  let component: ApiDocsViewerComponent;
  let fixture: ComponentFixture<ApiDocsViewerComponent>;
  let store: MockStore<AppState>;
  let themeServiceMock: { isDarkTheme: ReturnType<typeof signal<boolean>> };

  beforeEach(async () => {
    themeServiceMock = { isDarkTheme: signal(false) };
    await TestBed.configureTestingModule({
      imports: [ApiDocsViewerComponent],
      providers: [
        {
          provide: ThemeService,
          useValue: themeServiceMock,
        },
        provideMockStore({
          selectors: [
            { selector: selectOpenApiSpecContent, value: "openapi: 3.0.0\ninfo:\n  title: Test" },
            { selector: selectGeneratedFiles, value: [] }
          ],
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApiDocsViewerComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should dispatch apiDocsIframeLoaded on init (dummy to clear state)", () => {
    const dispatchSpy = vi.spyOn(store, "dispatch");
    component.ngOnInit();
    expect(dispatchSpy).toHaveBeenCalledWith(WorkspaceActions.apiDocsIframeLoaded());
  });

  it("should dispatch setApiDocsVisibility on retryLoad", () => {
    const dispatchSpy = vi.spyOn(store, "dispatch");
    component.retryLoad();
    expect(dispatchSpy).toHaveBeenCalledWith(
      WorkspaceActions.setApiDocsVisibility({ visible: true }),
    );
  });

  it("should return correct theme string based on isDarkTheme", () => {
    expect(component.theme()).toBe("light");
    themeServiceMock.isDarkTheme.set(true);
    expect(component.theme()).toBe("dark");
  });

  it("should map sdk examples correctly", () => {
    store.overrideSelector(selectGeneratedFiles, [{ path: 'test.ts', content: new Uint8Array([116, 101, 115, 116]) }]);
    store.refreshState();
    expect(component.mappedSdkExamples()).toEqual([{ language: 'typescript', filepath: 'test.ts', content: 'test' }]);
  });
});
