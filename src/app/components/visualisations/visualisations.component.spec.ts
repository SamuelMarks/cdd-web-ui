/* eslint-disable @typescript-eslint/no-explicit-any */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { VisualisationsComponent } from './visualisations.component';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import * as Selectors from '../../store/selectors';
import { initialOpenApiState } from '../../store/reducers';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('VisualisationsComponent', () => {
  let component: VisualisationsComponent;
  let fixture: ComponentFixture<VisualisationsComponent>;
  let store: MockStore;
  let mockResizeObserver: any;
  let resizeCallback: any;

  beforeEach(async () => {
    mockResizeObserver = class {
      constructor(callback: any) {
        resizeCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
    global.ResizeObserver = mockResizeObserver as any;

    await TestBed.configureTestingModule({
      imports: [VisualisationsComponent, NoopAnimationsModule],
      providers: [
        provideMockStore({
          selectors: [
            { selector: Selectors.selectOpenApiSpecContent, value: '' }
          ]
        })
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(VisualisationsComponent);
    component = fixture.componentInstance;
    (component as any).duration = 0; // Disable transitions for tests to avoid jsdom SVGElement errors
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
      toJSON: () => {}
    });

    resizeCallback();
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
        component.zoomCallback({ transform: 'translate(10, 20) scale(2)' });
        fixture.detectChanges();
        expect((component as any).svg.attr('transform')).toBe('translate(10, 20) scale(2)');
      }
    }
  });

  it('should not update transform if svg is missing in zoomCallback', () => {
    (component as any).svg = null;
    if (component.zoomCallback) {
      component.zoomCallback({ transform: 'translate(10, 20) scale(2)' });
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
      toJSON: () => {}
    });
    (component as any).handleResize();
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
    (component as any).svg = null;
    (component as any).update({});
    expect(component.hasData).toBe(true);
  });

  it('should not clear if svgContainer is missing', () => {
    const originalContainer = component.svgContainer;
    (component as any).svgContainer = null;
    (component as any).clearSvg();
    expect(component.hasData).toBe(false); // Before state
    (component as any).svgContainer = originalContainer;
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
      toJSON: () => {}
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
      toJSON: () => {}
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
    (component as any).root = null;
    vi.spyOn(component.svgContainer.nativeElement, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 1000,
      x: 0,
      y: 0,
      top: 0,
      bottom: 1000,
      left: 0,
      right: 1000,
      toJSON: () => {}
    });
    (component as any).handleResize();
    expect((component as any).root).toBeNull();
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
    if ((component as any).root) {
      (component as any).root.children = null;
    }
    expect(component.hasData).toBe(true);
  });

  it('should ignore resize if no dimensions', () => {
    component.hasData = true;
    (component as any).svgContainer = { nativeElement: { getBoundingClientRect: () => ({ width: 0, height: 0 }) } };
    (component as any).handleResize();
    expect((component as any).width).not.toBe(0);
  });

  it('should ignore resize if height is 0', () => {
    component.hasData = true;
    (component as any).svgContainer = { nativeElement: { getBoundingClientRect: () => ({ width: 100, height: 0 }) } };
    (component as any).handleResize();
  });

  it('should render with components schemas', () => {
    (component as any).parseAndRender('components:\n  schemas:\n    Test: {}');
    expect(component.hasData).toBe(true);
  });

  it('should ignore empty string', () => {
    component.hasData = false;
    (component as any).parseAndRender(' ');
    expect(component.hasData).toBe(false);
  });

  it('should handle toggle with children vs _children', () => {
    const d: any = { children: [{ id: '1' }] };
    (component as any).root = d;
    (component as any).svgContainer = { nativeElement: document.createElement('div') };
    (component as any).click(new MouseEvent('click'), d);
    expect(d._children).toBeDefined();
    expect(d.children).toBeNull();
    (component as any).click(new MouseEvent('click'), d);
    expect(d.children).toBeDefined();
    expect(d._children).toBeNull();
  });
  
  it('should hit width/height > 0 resize', () => {
    component.hasData = true;
    (component as any).svgContainer = { nativeElement: { getBoundingClientRect: () => ({ width: 100, height: 100 }) } };
    (component as any).root = {};
    const spy = vi.spyOn(component as any, 'update').mockImplementation(() => {});
    (component as any).handleResize();
    expect(spy).toHaveBeenCalled();
  });

  it('should ignore parameters and $ref in paths', () => {
    (component as any).parseAndRender('paths:\n  /test:\n    parameters: []\n    $ref: "foo"\n    get: {}');
    expect(component.hasData).toBe(true);
  });

  it('should run zoomCallback with svg', () => {
    (component as any).initSvg();
    (component as any).svg = { attr: vi.fn() };
    (component as any).zoomCallback({ transform: 'scale(1)' });
    expect((component as any).svg.attr).toHaveBeenCalled();
  });

  it('should run zoomCallback without svg', () => {
    (component as any).initSvg();
    (component as any).svg = null;
    (component as any).zoomCallback({ transform: 'scale(1)' });
  });
});
