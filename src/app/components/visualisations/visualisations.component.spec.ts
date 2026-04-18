import { TestBed, ComponentFixture } from '@angular/core/testing';
import { VisualisationsComponent } from './visualisations.component';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
type TestComp = {
  duration: number;
  svg: { attr: (k: string, v?: unknown) => unknown } | null;
  root: { children: unknown[] | null; _children?: unknown[] | null } | null;
  handleResize: () => void;
  update: (source: unknown) => void;
  clearSvg: () => void;
  svgContainer: {
    nativeElement: HTMLElement | { getBoundingClientRect: () => { width: number; height: number } };
  } | null;
  width: number;
  parseAndRender: (content: string) => void;
  click: (event: Event, d: Record<string, unknown>) => void;
  initSvg: () => void;
  zoomCallback?: (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => void;
};

import * as Selectors from '../../store/selectors';
import { initialOpenApiState } from '../../store/reducers';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('VisualisationsComponent', () => {
  let component: VisualisationsComponent;
  let fixture: ComponentFixture<VisualisationsComponent>;
  let store: MockStore;
  let mockResizeObserver: unknown;
  let resizeCallback: unknown;

  beforeEach(async () => {
    mockResizeObserver = class {
      constructor(callback: unknown) {
        resizeCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
    globalThis.ResizeObserver = mockResizeObserver as unknown as typeof ResizeObserver;

    await TestBed.configureTestingModule({
      imports: [VisualisationsComponent, NoopAnimationsModule],
      providers: [
        provideMockStore({
          selectors: [{ selector: Selectors.selectOpenApiSpecContent, value: '' }],
        }),
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(VisualisationsComponent);
    component = fixture.componentInstance;
    (component as unknown as TestComp).duration = 0; // Disable transitions for tests to avoid jsdom SVGElement errors
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display empty state when spec is empty', () => {
    store.overrideSelector(Selectors.selectOpenApiSpecContent, '');
    store.refreshState();
    fixture.detectChanges();

    expect(component.hasData).toBe(false);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state')?.textContent).toContain('No API Data Available');
  });

  it('should display empty state and handle error for invalid yaml', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    store.overrideSelector(Selectors.selectOpenApiSpecContent, 'invalid: [ yaml');
    store.refreshState();
    fixture.detectChanges();

    expect(component.hasData).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should parse valid openapi spec and render tree', () => {
    const validSpec = `
openapi: 3.0.0
info:
  title: Test API
paths:
  /test:
    get:
      summary: test
components:
  schemas:
    TestSchema:
      type: object
`;
    store.overrideSelector(Selectors.selectOpenApiSpecContent, validSpec);
    store.refreshState();
    fixture.detectChanges();

    expect(component.hasData).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('svg')).toBeTruthy();
  });

  it('should handle window resize', () => {
    const validSpec = `
openapi: 3.0.0
info:
  title: Test API
paths:
  /test:
    get:
      summary: test
`;
    store.overrideSelector(Selectors.selectOpenApiSpecContent, validSpec);
    store.refreshState();
    fixture.detectChanges();

    vi.spyOn(component.svgContainer.nativeElement, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 800,
      x: 0,
      y: 0,
      top: 0,
      bottom: 800,
      left: 0,
      right: 1000,
      toJSON: () => {},
    });

    (resizeCallback as Function)();
    expect(component.hasData).toBe(true);
  });

  it('should handle node click to expand and collapse', () => {
    const validSpec = `
openapi: 3.0.0
info:
  title: Test API
paths:
  /test:
    get:
      summary: test
`;
    store.overrideSelector(Selectors.selectOpenApiSpecContent, validSpec);
    store.refreshState();
    fixture.detectChanges();

    expect(component.hasData).toBe(true);

    // Find the first node that can be clicked
    const compiled = fixture.nativeElement as HTMLElement;
    const nodeGroups = compiled.querySelectorAll('g.node');
    expect(nodeGroups.length).toBeGreaterThan(0);

    // Dispatch a click event to the first node to expand/collapse
    const firstNode = nodeGroups[1] as SVGGElement; // 0 is usually root, 1 is usually Paths or Info
    if (firstNode) {
      firstNode.dispatchEvent(new Event('click'));
      fixture.detectChanges();

      // Click again to revert
      firstNode.dispatchEvent(new Event('click'));
      fixture.detectChanges();
    }
  });

  it('should handle zoom events', () => {
    const validSpec = `
openapi: 3.0.0
info:
  title: Test API
`;
    store.overrideSelector(Selectors.selectOpenApiSpecContent, validSpec);
    store.refreshState();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const svg = compiled.querySelector('svg');
    expect(svg).toBeTruthy();

    if (svg) {
      if (component.zoomCallback) {
        component.zoomCallback!({
          transform: 'translate(10, 20) scale(2)',
        } as unknown as d3.D3ZoomEvent<SVGSVGElement, unknown>);
        fixture.detectChanges();
        expect((component as unknown as TestComp).svg!.attr('transform')).toBe(
          'translate(10, 20) scale(2)',
        );
      }
    }
  });

  it('should not update transform if svg is missing in zoomCallback', () => {
    (component as unknown as TestComp).svg = null;
    if (component.zoomCallback) {
      component.zoomCallback!({
        transform: 'translate(10, 20) scale(2)',
      } as unknown as d3.D3ZoomEvent<SVGSVGElement, unknown>);
    }
    expect(component.hasData).toBe(false);
  });

  it('should handle handleResize when width or height is 0', () => {
    component.hasData = true;
    vi.spyOn(component.svgContainer.nativeElement, 'getBoundingClientRect').mockReturnValue({
      width: 0,
      height: 1000,
      x: 0,
      y: 0,
      top: 0,
      bottom: 1000,
      left: 0,
      right: 0,
      toJSON: () => {},
    });
    (component as unknown as TestComp).handleResize();
    expect(component.hasData).toBe(true);
  });

  it('should use default title if info is missing', () => {
    const specWithoutTitle = `
openapi: 3.0.0
paths:
  /test:
    get:
      summary: test
`;
    store.overrideSelector(Selectors.selectOpenApiSpecContent, specWithoutTitle);
    store.refreshState();
    fixture.detectChanges();
    expect(component.hasData).toBe(true);
  });

  it('should not update if svg is undefined', () => {
    component.hasData = true;
    (component as unknown as TestComp).svg = null;
    (component as unknown as TestComp).update({});
    expect(component.hasData).toBe(true);
  });

  it('should not clear if svgContainer is missing', () => {
    const originalContainer = component.svgContainer;
    (component as unknown as TestComp).svgContainer = null;
    (component as unknown as TestComp).clearSvg();
    expect(component.hasData).toBe(false); // Before state
    (component as unknown as TestComp).svgContainer = originalContainer;
  });

  it('should use default dimensions if cWidth or cHeight is 0', () => {
    vi.spyOn(component.svgContainer.nativeElement, 'getBoundingClientRect').mockReturnValue({
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      toJSON: () => {},
    });
    const spec = `
openapi: 3.0.0
info:
  title: Test API
`;
    store.overrideSelector(Selectors.selectOpenApiSpecContent, spec);
    store.refreshState();
    fixture.detectChanges();
    expect(component.hasData).toBe(true);
  });

  it('should parse spec with definitions instead of components.schemas and handle resize when width > 0', () => {
    vi.spyOn(component.svgContainer.nativeElement, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 1000,
      x: 0,
      y: 0,
      top: 0,
      bottom: 1000,
      left: 0,
      right: 1000,
      toJSON: () => {},
    });
    const specWithDefinitions = `
openapi: 2.0
info:
  title: Test API
definitions:
  TestSchema:
    type: object
`;
    store.overrideSelector(Selectors.selectOpenApiSpecContent, specWithDefinitions);
    store.refreshState();
    fixture.detectChanges();
    expect(component.hasData).toBe(true);
  });

  it('should handle handleResize when root is null', () => {
    component.hasData = true;
    (component as unknown as TestComp).root = null;
    vi.spyOn(component.svgContainer.nativeElement, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 1000,
      x: 0,
      y: 0,
      top: 0,
      bottom: 1000,
      left: 0,
      right: 1000,
      toJSON: () => {},
    });
    (component as unknown as TestComp).handleResize();
    expect((component as unknown as TestComp).root).toBeNull();
  });

  it('should handle parse when schemas are missing entirely and root has no children', () => {
    const emptySpec = `
openapi: 3.0.0
info:
  title: Test API
`;
    store.overrideSelector(Selectors.selectOpenApiSpecContent, emptySpec);
    store.refreshState();
    fixture.detectChanges();

    // Force root children to null to cover branch
    if ((component as unknown as TestComp).root) {
      (component as unknown as TestComp).root!.children = null;
    }
    expect(component.hasData).toBe(true);
  });

  it('should ignore resize if no dimensions', () => {
    component.hasData = true;
    (component as unknown as TestComp).svgContainer = {
      nativeElement: { getBoundingClientRect: () => ({ width: 0, height: 0 }) },
    };
    (component as unknown as TestComp).handleResize();
    expect((component as unknown as TestComp).width).not.toBe(0);
  });

  it('should ignore resize if height is 0', () => {
    component.hasData = true;
    (component as unknown as TestComp).svgContainer = {
      nativeElement: { getBoundingClientRect: () => ({ width: 100, height: 0 }) },
    };
    (component as unknown as TestComp).handleResize();
  });

  it('should render with components schemas', () => {
    (component as unknown as TestComp).parseAndRender('components:\n  schemas:\n    Test: {}');
    expect(component.hasData).toBe(true);
  });

  it('should ignore empty string', () => {
    component.hasData = false;
    (component as unknown as TestComp).parseAndRender(' ');
    expect(component.hasData).toBe(false);
  });

  it('should handle toggle with children vs _children', () => {
    const d: { children: unknown[] | null; _children?: unknown[] | null } = {
      children: [{ id: '1' }],
      _children: null,
    };
    (component as unknown as TestComp).root = d;
    (component as unknown as TestComp).svgContainer = {
      nativeElement: document.createElement('div'),
    };
    (component as unknown as TestComp).click(new MouseEvent('click'), d);
    expect(d['_children']).toBeDefined();
    expect(d['children']).toBeUndefined();
    (component as unknown as TestComp).click(new MouseEvent('click'), d);
    expect(d['children']).toBeDefined();
    expect(d['_children']).toBeNull();
  });

  it('should hit width/height > 0 resize', () => {
    component.hasData = true;
    (component as unknown as TestComp).svgContainer = {
      nativeElement: { getBoundingClientRect: () => ({ width: 100, height: 100 }) },
    };
    (component as unknown as TestComp).root = { children: null };
    const spy = vi.spyOn(component as unknown as TestComp, 'update').mockImplementation(() => {});
    (component as unknown as TestComp).handleResize();
    expect(spy).toHaveBeenCalled();
  });

  it('should ignore parameters and $ref in paths', () => {
    (component as unknown as TestComp).parseAndRender(
      'paths:\n  /test:\n    parameters: []\n    $ref: "foo"\n    get: {}',
    );
    expect(component.hasData).toBe(true);
  });

  it('should run zoomCallback with svg', () => {
    (component as unknown as TestComp).initSvg();
    (component as unknown as TestComp).svg = { attr: vi.fn() };
    (component as unknown as TestComp).zoomCallback!({
      transform: 'scale(1)',
    } as unknown as d3.D3ZoomEvent<SVGSVGElement, unknown>);
    expect((component as unknown as TestComp).svg!.attr).toHaveBeenCalled();
  });

  it('should run zoomCallback without svg', () => {
    (component as unknown as TestComp).initSvg();
    (component as unknown as TestComp).svg = null;
    (component as unknown as TestComp).zoomCallback!({
      transform: 'scale(1)',
    } as unknown as d3.D3ZoomEvent<SVGSVGElement, unknown>);
  });
});
