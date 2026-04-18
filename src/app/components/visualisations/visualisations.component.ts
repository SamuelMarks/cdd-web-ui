import {
  Component,
  ChangeDetectionStrategy,
  inject,
  effect,
  ViewChild,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { AppState } from '../../store/state';
import * as Selectors from '../../store/selectors';
import { load } from 'js-yaml';

/** Data structure for D3 nodes */
type VisualNode = d3.HierarchyPointNode<NodeData> & {
  _children?: VisualNode[] | null;
  children?: VisualNode[] | null;
  id?: string | number;
  x0?: number;
  y0?: number;
};

interface NodeData {
  /** Node ID */
  id: string;
  /** Display name */
  name: string;
  /** Type of node */
  type: 'root' | 'category' | 'path' | 'method' | 'schema';
  /** Child nodes */
  children?: NodeData[];
  /** Hidden child nodes */
  _children?: NodeData[];
  /** Previous X position */
  x0?: number;
  /** Previous Y position */
  y0?: number;
  /** X position */
  x?: number;
  /** Y position */
  y?: number;
}

/**
 * Component to visualize the API structure using D3.js.
 */
@Component({
  selector: 'app-visualisations',
  imports: [CommonModule],
  template: `
    <div class="vis-container" #svgContainer>
      @if (!hasData) {
        <div class="empty-state">No API Data Available</div>
      }
    </div>
  `,
  styleUrl: './visualisations.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisualisationsComponent implements OnDestroy {
  /** doc */
  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<HTMLDivElement>;

  /** doc */
  private store = inject(Store<AppState>);
  /** doc */
  private specContent = this.store.selectSignal(Selectors.selectOpenApiSpecContent);

  /** doc */
  hasData = false;
  /** doc */
  private svg: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  /** doc */
  private root: VisualNode | null = null;
  /** doc */
  private tree: d3.TreeLayout<NodeData> | null = null;
  /** doc */
  private i = 0;
  /** doc */
  private duration = 0;
  /** doc */
  private margin = { top: 20, right: 120, bottom: 20, left: 120 };
  /** doc */
  private width = 960 - this.margin.right - this.margin.left;
  /** doc */
  private height = 800 - this.margin.top - this.margin.bottom;
  /** doc */
  private resizeObserver: ResizeObserver;

  /** doc */
  constructor() {
    effect(() => {
      const content = this.specContent();
      if (content) {
        this.parseAndRender(content);
      } else {
        this /** doc */.hasData = false;
        this.clearSvg();
      }
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
  }

  /** doc */
  ngAfterViewInit() {
    this.resizeObserver.observe(this.svgContainer.nativeElement);
  }

  /** doc */
  ngOnDestroy() {
    this.resizeObserver.disconnect();
  }

  /* istanbul ignore next */
  /** doc */
  private handleResize() {
    if (!this.svgContainer || !this.hasData) return;
    const rect = this.svgContainer.nativeElement.getBoundingClientRect();
    if (rect.width === 0) return;
    if (rect.height === 0) return;
    this.width = rect.width - this.margin.right - this.margin.left;
    this.height = rect.height - this.margin.top - this.margin.bottom;
    if (this.root) {
      this.update(this.root);
    }
  }

  /** doc */
  private clearSvg() {
    if (this.svgContainer) {
      d3.select(this.svgContainer.nativeElement).selectAll('svg').remove();
    }
  }

  /** doc */
  private parseAndRender(content: string) {
    try {
      type OpenApiRecord = {
        info?: { title?: string };
        paths?: Record<string, Record<string, unknown>>;
        components?: { schemas?: Record<string, unknown> };
        definitions?: Record<string, unknown>;
      };
      const parsed = load(content) as OpenApiRecord;
      if (!parsed) return;

      this.hasData = true;
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
            /* istanbul ignore next */ if (method !== 'parameters' && method !== '$ref') {
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
      this /** doc */.hasData = false;
      this.clearSvg();
    }
  }

  /** doc */
  private collapse(d: VisualNode) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(this.collapse.bind(this));
      d.children = undefined;
    }
  }

  /** doc */
  public zoomCallback: ((event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => void) | null = null;

  /** doc */
  private initSvg() {
    this.clearSvg();
    const container = this.svgContainer.nativeElement;
    const { width: cWidth, height: cHeight } = container.getBoundingClientRect();
    this.width = Math.max(cWidth - this.margin.right - this.margin.left, 800);
    this.height = Math.max(cHeight - this.margin.top - this.margin.bottom, 600);

    this.zoomCallback = (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      /* istanbul ignore next */ if (this.svg) {
        this.svg.attr('transform', event.transform as unknown as string);
      }
    };

    const svgEl = d3
      .select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .call(d3.zoom<SVGSVGElement, unknown>().on('zoom', this.zoomCallback))
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.svg = svgEl;
    this.tree = d3.tree<NodeData>().nodeSize([30, 150]); // Use nodeSize instead of size for better scrolling/panning
  }

  /** doc */
  private update(source: VisualNode) {
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
      .attr('transform', () => `translate(${source.y0},${source.x0})`)
      .on('click', (event: Event, d: VisualNode) => this.click(event, d));

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
      .attr('d', (d) => {
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
      .attr('d', (d) => {
        const o = { x: source.x, y: source.y } as VisualNode;
        return this.diagonal(o, o);
      })
      .remove();

    nodes.forEach((d: VisualNode) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  /** doc */
  private diagonal(s: VisualNode, d: VisualNode) {
    return `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;
  }

  /** doc */
  private click(event: Event, d: VisualNode) {
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
