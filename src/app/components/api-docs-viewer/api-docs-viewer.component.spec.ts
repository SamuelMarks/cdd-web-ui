import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiDocsViewerComponent } from './api-docs-viewer.component';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { AppState } from '../../store/state';
import {
  selectApiDocsLoadState,
  selectOpenApiSpecContent,
  selectOpenApiValidationErrors,
} from '../../store/selectors';
import * as WorkspaceActions from '../../store/actions';
import { By } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocsSyncService } from '../../services/docs-sync.service';
import { ThemeService } from '../../services/theme.service';
import { signal } from '@angular/core';

describe('ApiDocsViewerComponent', () => {
  let component: ApiDocsViewerComponent;
  let fixture: ComponentFixture<ApiDocsViewerComponent>;
  let store: MockStore<AppState>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApiDocsViewerComponent],
      providers: [
        DocsSyncService,
        {
          provide: ThemeService,
          useValue: { isDarkTheme: signal(false) },
        },
        provideMockStore({
          selectors: [
            { selector: selectApiDocsLoadState, value: 'LOADING' },
            { selector: selectOpenApiSpecContent, value: '' },
            { selector: selectOpenApiValidationErrors, value: [] },
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should dispatch timeout error after 10s if state is still LOADING', () => {
    vi.useFakeTimers();
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    component.ngOnInit();
    vi.advanceTimersByTime(10000);
    expect(dispatchSpy).toHaveBeenCalledWith(
      WorkspaceActions.apiDocsIframeLoadFailed({ error: 'Timeout loading API Docs iframe.' }),
    );
    vi.useRealTimers();
  });

  it('should not dispatch timeout error if state is not LOADING', () => {
    vi.useFakeTimers();
    store.overrideSelector(selectApiDocsLoadState, 'LOADED');
    store.refreshState();
    fixture.detectChanges();
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    component.ngOnInit();
    vi.advanceTimersByTime(10000);
    expect(dispatchSpy).not.toHaveBeenCalledWith(
      WorkspaceActions.apiDocsIframeLoadFailed({ error: 'Timeout loading API Docs iframe.' }),
    );
    vi.useRealTimers();
  });


  it('should clear timeout and dispatch success on iframe load', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    component.onIframeLoad();
    expect(dispatchSpy).toHaveBeenCalledWith(WorkspaceActions.apiDocsIframeLoaded());
  });

  it('should reset safeIframeUrl and dispatch visibility on retryLoad', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    const oldUrl = component.safeIframeUrl();
    component.retryLoad();
    const newUrl = component.safeIframeUrl();
    expect(dispatchSpy).toHaveBeenCalledWith(
      WorkspaceActions.setApiDocsVisibility({ visible: true }),
    );
    expect(oldUrl).not.toBe(newUrl); // because of the '?retry=' timestamp
  });

  it('should dispatch close on close button click', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    component.close();
    expect(dispatchSpy).toHaveBeenCalledWith(
      WorkspaceActions.setApiDocsVisibility({ visible: false }),
    );
  });

  it('should open new window on popOut', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    component.popOut();
    expect(openSpy).toHaveBeenCalledWith('/docs-ui/index.html', '_blank');
  });
});
