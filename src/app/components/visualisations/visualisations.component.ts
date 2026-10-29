/**
 * Interactive D3.js tree visualization component for OpenAPI paths and schemas.
 * @module app/components/visualisations/visualisations.component
 */
import { Component, inject, effect, viewChild, ElementRef, OnDestroy, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import * as d3 from 'd3';
import { AppState } from '../../store/state';
import * as Selectors from '../../store/selectors';
import { load } from 'js-yaml';

/** Data structure for D3 nodes */
type VisualNode = d3.HierarchyPointNode<NodeData> & {
  /** Collapsed child nodes */
  _children?: VisualNode[] | null;
  /** Expanded child nodes */
  children?: VisualNode[] | null;
  /** Node identifier */
  id?: string | number;
  /** Previous X coordinate */
  x0?: number;
  /** Previous Y coordinate */
  y0?: number;
};

/** Data structure representing a node in the visualised API tree */
interface NodeData {
  /** Node ID */
  id: string;
  /** Display name */
  name: string;
  /** Type of node */
  type: 'root' | 'category' | 'path' | 'method' | 'schema';
  /** Child nodes */
  children?: NodeData[];
  /** Hidden child nodes (when collapsed) */
  _children?: NodeData[];
  /** Previous X position (for animations) */
  x0?: number;
  /** Previous Y position (for animations) */
  y0?: number;
  /** Target X position */
  x?: number;
  /** Target Y position */
  y?: number;
}

/**
 * Component to visualize the API structure using D3.js.
 */
@Component({
  selector: 'app-visualisations',
  imports: [],
  template: `
    <div class="vis-container" #svgContainer>
      @if (!hasData()) {
        <div class="empty-state" i18n="@@noApiData">No API Data Available</div>
      }
    </div>
  `,
  styleUrl: './visualisations.component.css',
})
export class VisualisationsComponent implements OnDestroy {
  /** Signal query for the SVG container element */
  readonly svgContainerSignal = viewChild<ElementRef<HTMLDivElement>>('svgContainer');

  /** Overridable container reference for tests */
  private _svgContainerOverride?: ElementRef<HTMLDivElement> | null;

  /** Accessor for the SVG container element */
  get svgContainer(): ElementRef<HTMLDivElement> {
    if (this._svgContainerOverride !== undefined) {
      return this._svgContainerOverride as ElementRef<HTMLDivElement>;
    }
    return this.svgContainerSignal()!;
  }

  /**
   * Sets an override reference for the SVG container element.
   * @param val The ElementRef wrapping the SVG container div.
   */
  set svgContainer(val: ElementRef<HTMLDivElement>) {
    this._svgContainerOverride = val;
  }

  /** NgRx store instance */
  private store = inject(Store<AppState>);
  /** OpenAPI specification content signal */
  private specContent = this.store.selectSignal(Selectors.selectOpenApiSpecContent);

  /** Signal indicating if tree visualization data is available */
  hasData = signal(false);
  /** Root SVG group selection */
  private svg: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  /** Root D3 hierarchy node */
  private root: VisualNode | null = null;
  /** D3 tree layout instance */
  private tree: d3.TreeLayout<NodeData> | null = null;
  /** Auto-incrementing counter for node IDs */
  private i = 0;
  /** Transition duration in milliseconds */
  private duration = 0;
  /** SVG layout margins */
  private margin = { top: 20, right: 120, bottom: 20, left: 120 };
  /** Computed inner width of the SVG canvas */
  private width = 960 - this.margin.right - this.margin.left;
  /** Computed inner height of the SVG canvas */
  private height = 800 - this.margin.top - this.margin.bottom;
  /** ResizeObserver tracking container dimension changes */
  private resizeObserver: ResizeObserver;

  /** Initializes reactive rendering and resize observation. */
  constructor() {
    effect(() => {
      const content = this.specContent();
      if (content) {
        this.parseAndRender(content);
      } else {
        this.hasData.set(false);
        this.clearSvg();
      }
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
  }

  /** Starts observing the SVG container once the view is initialized. */
  ngAfterViewInit(): void {
    this.resizeObserver.observe(this.svgContainer.nativeElement);
  }

  /** Disconnects the ResizeObserver when the component is destroyed. */
  ngOnDestroy(): void {
    this.resizeObserver.disconnect();
  }

  /** Recalculates layout dimensions when the container resizes. */
  private handleResize(): void {
    if (!this.svgContainer || !this.hasData()) return;
    const rect = this.svgContainer.nativeElement.getBoundingClientRect();
    if (rect.width === 0) return;
    if (rect.height === 0) return;
    this.width = rect.width - this.margin.right - this.margin.left;
    this.height = rect.height - this.margin.top - this.margin.bottom;
    if (this.root) {
      this.update(this.root);
    }
  }

  /** Removes any rendered SVG elements from the container. */
  private clearSvg(): void {
    if (this.svgContainer) {
      d3.select(this.svgContainer.nativeElement).selectAll('svg').remove();
    }
  }

  /**
   * Parses the OpenAPI specification string and renders the interactive D3 tree.
   * @param content Raw OpenAPI YAML or JSON string.
   */
  private parseAndRender(content: string): void {
    try {
      /** Internal representation of parsed OpenAPI fields for visualization. */
      type OpenApiRecord = {
        /** API metadata block */
        info?: {
          /** API title */
          title?: string;
        };
        /** API paths map */
        paths?: Record<string, Record<string, unknown>>;
        /** OpenAPI 3.x components block */
        components?: {
          /** Schema definitions map */
          schemas?: Record<string, unknown>;
        };
        /** Swagger 2.0 definitions map */
        definitions?: Record<string, unknown>;
      };
      const parsed = load(content) as OpenApiRecord;
      if (!parsed) return;

      this.hasData.set(true);
      const rootData: NodeData = {
        id: 'root',
        name: parsed.info?.title || 'API',
        type: 'root',
        children: [],
      };

      if (parsed.paths) {
        const pathsNode: NodeData = { id: 'paths', name: 'Paths', type: 'category', children: [] };
        Object.keys(parsed.paths).forEach((pathStr) => {
          const pathNode: NodeData = {
            id: `path-${pathStr}`,
            name: pathStr,
            type: 'path',
            children: [],
          };
          const methods = parsed.paths![pathStr];
          Object.keys(methods).forEach((method) => {
            if (method !== 'parameters' && method !== '$ref') {
              pathNode.children!.push({
                id: `method-${pathStr}-${method}`,
                name: method.toUpperCase(),
                type: 'method',
              });
            }
          });
          pathsNode.children!.push(pathNode);
        });
        rootData.children!.push(pathsNode);
      }

      let schemas = undefined;
      if (parsed.components) {
        schemas = parsed.components.schemas;
      } else {
        schemas = parsed.definitions;
      }
      if (schemas) {
        const schemasNode: NodeData = {
          id: 'schemas',
          name: 'Schemas',
          type: 'category',
          children: [],
        };
        Object.keys(schemas).forEach((schemaName) => {
          schemasNode.children!.push({
            id: `schema-${schemaName}`,
            name: schemaName,
            type: 'schema',
          });
        });
        rootData.children!.push(schemasNode);
      }

      this.initSvg();
      this.root = d3.hierarchy<NodeData>(rootData, (d) => d.children) as VisualNode;
      this.root.x0 = this.height / 2;
      this.root.y0 = 0;

      // Collapse all except first level
      (this.root.children || []).forEach(this.collapse.bind(this));

      this.update(this.root);
    } catch (e) {
      console.error('Error parsing OpenAPI spec for visualisation', e);
      this.hasData.set(false);
      this.clearSvg();
    }
  }

  /**
   * Recursively collapses a node and all of its descendants.
   * @param d The VisualNode to collapse.
   */
  private collapse(d: VisualNode): void {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(this.collapse.bind(this));
      d.children = undefined;
    }
  }

  /** Callback invoked on D3 zoom events. */
  public zoomCallback: ((event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => void) | null = null;

  /** Initializes the SVG element, zoom behavior, and D3 tree layout. */
  private initSvg(): void {
    this.clearSvg();
    const container = this.svgContainer.nativeElement;
    const { width: cWidth, height: cHeight } = container.getBoundingClientRect();
    this.width = Math.max(cWidth - this.margin.right - this.margin.left, 800);
    this.height = Math.max(cHeight - this.margin.top - this.margin.bottom, 600);

    this.zoomCallback = (event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void => {
      if (this.svg) {
        this.svg.attr('transform', event.transform as unknown as string);
      }
    };

    const svgEl = d3
      .select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('role', 'img')
      .attr('aria-label', 'API Structure Diagram')
      .call(d3.zoom<SVGSVGElement, unknown>().on('zoom', this.zoomCallback))
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.svg = svgEl;
    this.tree = d3.tree<NodeData>().nodeSize([30, 150]); // Use nodeSize instead of size for better scrolling/panning
  }

  /**
   * Updates the D3 tree nodes and links from a given source node.
   * @param source The VisualNode that triggered the layout update.
   */
  private update(source: VisualNode): void {
    if (!this.svg) return;

    const treeData = this.tree!(this.root as d3.HierarchyNode<NodeData>);
    const nodes = treeData.descendants() as VisualNode[];
    const links = treeData.descendants().slice(1) as VisualNode[];

    nodes.forEach((d: VisualNode) => {
      d.y = d.depth * 180;
    });

    const node = (this.svg as unknown as d3.Selection<SVGGElement, VisualNode, null, undefined>)
      .selectAll<SVGGElement, VisualNode>('g.node')
      .data(nodes, (d) => (d.id ? String(d.id) : String((d.id = String(++this.i)))));

    const nodeEnter = node
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('tabindex', '0')
      .attr('role', 'button')
      .attr('aria-label', (d) => `${d.data.type}: ${d.data.name}`)
      .attr('transform', () => `translate(${source.y0},${source.x0})`)
      .on('click', (event: Event, d: VisualNode) => this.click(event, d))
      .on('keydown', (event: KeyboardEvent, d: VisualNode) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.click(event, d);
        }
      });

    nodeEnter
      .append('circle')
      .attr('class', 'node-circle')
      .attr('r', 1e-6)
      .style('fill', (d) => (d._children ? 'var(--mat-sys-primary)' : 'var(--mat-sys-surface)'))
      .style('stroke', 'var(--mat-sys-primary)')
      .style('stroke-width', '1.5px');

    nodeEnter
      .append('text')
      .attr('dy', '.35em')
      .attr('x', (d) => (d.children || d._children ? -13 : 13))
      .attr('text-anchor', (d) => (d.children || d._children ? 'end' : 'start'))
      .text((d) => d.data.name)
      .style('fill', 'var(--mat-sys-on-surface)')
      .style('font-size', '12px');

    const nodeUpdate = nodeEnter.merge(node);

    nodeUpdate
      .attr('aria-expanded', (d) => (d.children ? 'true' : d._children ? 'false' : null))
      .transition()
      .duration(this.duration)
      .attr('transform', (d) => `translate(${d.y},${d.x})`);

    nodeUpdate
      .select('circle.node-circle')
      .attr('r', 6)
      .style('fill', (d) => (d._children ? 'var(--mat-sys-primary)' : 'var(--mat-sys-surface)'))
      .attr('cursor', 'pointer');

    const nodeExit = node
      .exit()
      .transition()
      .duration(this.duration)
      .attr('transform', () => `translate(${source.y},${source.x})`)
      .remove();

    nodeExit.select('circle').attr('r', 1e-6);

    nodeExit.select('text').style('fill-opacity', 1e-6);

    const link = (this.svg as unknown as d3.Selection<SVGGElement, VisualNode, null, undefined>)
      .selectAll<SVGPathElement, VisualNode>('path.link')
      .data(links, (d) => String(d.id));

    const linkEnter = link
      .enter()
      .insert('path', 'g')
      .attr('class', 'link')
      .style('fill', 'none')
      .style('stroke', 'var(--mat-sys-outline)')
      .style('stroke-width', '1.5px')
      .attr('d', () => {
        const o = { x: source.x0, y: source.y0 } as VisualNode;
        return this.diagonal(o, o);
      });

    const linkUpdate = linkEnter.merge(link);

    linkUpdate
      .transition()
      .duration(this.duration)
      .attr('d', (d) => this.diagonal(d, d.parent as VisualNode));

    link
      .exit()
      .transition()
      .duration(this.duration)
      .attr('d', () => {
        const o = { x: source.x, y: source.y } as VisualNode;
        return this.diagonal(o, o);
      })
      .remove();

    nodes.forEach((d: VisualNode) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  /**
   * Generates a cubic Bezier SVG path string connecting two nodes.
   * @param s Source VisualNode.
   * @param d Destination VisualNode.
   * @returns SVG path data string.
   */
  private diagonal(s: VisualNode, d: VisualNode): string {
    return `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;
  }

  /**
   * Toggles children expansion when a node is clicked or activated via keyboard.
   * @param event DOM click or keyboard event.
   * @param d The clicked VisualNode.
   */
  private click(event: Event, d: VisualNode): void {
    if (d.children) {
      d._children = d.children;
      d.children = undefined;
    } else {
      d.children = d._children as VisualNode[] | undefined;
      d._children = null;
    }
    this.update(d);
  }
}
