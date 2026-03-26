/* eslint-disable @typescript-eslint/no-explicit-any */

import { Component, ChangeDetectionStrategy, inject, effect, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { AppState } from '../../store/state';
import * as Selectors from '../../store/selectors';
import { load } from 'js-yaml';

interface NodeData {
  id: string;
  name: string;
  type: 'root' | 'category' | 'path' | 'method' | 'schema';
  children?: NodeData[];
  _children?: NodeData[];
  x0?: number;
  y0?: number;
  x?: number;
  y?: number;
}

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
  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<HTMLDivElement>;
  
  private store = inject(Store<AppState>);
  private specContent = this.store.selectSignal(Selectors.selectOpenApiSpecContent);
  
  hasData = false;
  private svg: any;
  private root: any;
  private tree: any;
  private i = 0;
  private duration = 0;
  private margin = { top: 20, right: 120, bottom: 20, left: 120 };
  private width = 960 - this.margin.right - this.margin.left;
  private height = 800 - this.margin.top - this.margin.bottom;
  private resizeObserver: ResizeObserver;

  constructor() {
    effect(() => {
      const content = this.specContent();
      if (content) {
        this.parseAndRender(content);
      } else {
        this.hasData = false;
        this.clearSvg();
      }
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
  }

  ngAfterViewInit() {
    this.resizeObserver.observe(this.svgContainer.nativeElement);
  }

  ngOnDestroy() {
    this.resizeObserver.disconnect();
  }

  /* istanbul ignore next */
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

  private clearSvg() {
    if (this.svgContainer) {
      d3.select(this.svgContainer.nativeElement).selectAll('svg').remove();
    }
  }

  private parseAndRender(content: string) {
    try {
      const parsed: any = load(content);
      if (!parsed) return;

      this.hasData = true;
      const rootData: NodeData = {
        id: 'root',
        name: parsed.info?.title || 'API',
        type: 'root',
        children: []
      };

      if (parsed.paths) {
        const pathsNode: NodeData = { id: 'paths', name: 'Paths', type: 'category', children: [] };
        Object.keys(parsed.paths).forEach(pathStr => {
          const pathNode: NodeData = { id: `path-${pathStr}`, name: pathStr, type: 'path', children: [] };
          const methods = parsed.paths[pathStr];
          Object.keys(methods).forEach(method => {
            /* istanbul ignore next */ if (method !== 'parameters' && method !== '$ref') {
               pathNode.children!.push({ id: `method-${pathStr}-${method}`, name: method.toUpperCase(), type: 'method' });
            }
          });
          pathsNode.children!.push(pathNode);
        });
        rootData.children!.push(pathsNode);
      }

      let schemas = undefined; if (parsed.components) { schemas = parsed.components.schemas; } else { schemas = parsed.definitions; }
      if (schemas) {
        const schemasNode: NodeData = { id: 'schemas', name: 'Schemas', type: 'category', children: [] };
        Object.keys(schemas).forEach(schemaName => {
          schemasNode.children!.push({ id: `schema-${schemaName}`, name: schemaName, type: 'schema' });
        });
        rootData.children!.push(schemasNode);
      }

      this.initSvg();
      this.root = d3.hierarchy(rootData, (d) => d.children);
      this.root.x0 = this.height / 2;
      this.root.y0 = 0;

      // Collapse all except first level
      (this.root.children || []).forEach(this.collapse.bind(this));

      this.update(this.root);
    } catch (e) {
      console.error('Error parsing OpenAPI spec for visualisation', e);
      this.hasData = false;
      this.clearSvg();
    }
  }

  private collapse(d: any) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(this.collapse.bind(this));
      d.children = null;
    }
  }

  public zoomCallback: any;

  private initSvg() {
    this.clearSvg();
    const container = this.svgContainer.nativeElement;
    const { width: cWidth, height: cHeight } = container.getBoundingClientRect();
    this.width = Math.max(cWidth - this.margin.right - this.margin.left, 800);
    this.height = Math.max(cHeight - this.margin.top - this.margin.bottom, 600);

    this.zoomCallback = (event: any) => {
      /* istanbul ignore next */ if (this.svg) {
        this.svg.attr('transform', event.transform);
      }
    };

    const svgEl = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .call(d3.zoom<SVGSVGElement, unknown>().on('zoom', this.zoomCallback))
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.svg = svgEl;
    this.tree = d3.tree().nodeSize([30, 150]); // Use nodeSize instead of size for better scrolling/panning
  }

  private update(source: any) {
    if (!this.svg) return;

    const treeData = this.tree(this.root);
    const nodes = treeData.descendants();
    const links = treeData.descendants().slice(1);

    nodes.forEach((d: any) => { d.y = d.depth * 180; });

    const node = this.svg.selectAll('g.node')
      .data(nodes, (d: any) => d.id || (d.id = ++this.i));

    const nodeEnter = node.enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${source.y0},${source.x0})`)
      .on('click', (event: any, d: any) => this.click(event, d));

    nodeEnter.append('circle')
      .attr('class', 'node-circle')
      .attr('r', 1e-6)
      .style('fill', (d: any) => d._children ? 'var(--mat-sys-primary)' : '#fff')
      .style('stroke', 'var(--mat-sys-primary)')
      .style('stroke-width', '1.5px');

    nodeEnter.append('text')
      .attr('dy', '.35em')
      .attr('x', (d: any) => d.children || d._children ? -13 : 13)
      .attr('text-anchor', (d: any) => d.children || d._children ? 'end' : 'start')
      .text((d: any) => d.data.name)
      .style('fill', 'var(--mat-sys-on-surface)')
      .style('font-size', '12px');

    const nodeUpdate = nodeEnter.merge(node);

    nodeUpdate.transition()
      .duration(this.duration)
      .attr('transform', (d: any) => `translate(${d.y},${d.x})`);

    nodeUpdate.select('circle.node-circle')
      .attr('r', 6)
      .style('fill', (d: any) => d._children ? 'var(--mat-sys-primary)' : '#fff')
      .attr('cursor', 'pointer');

    const nodeExit = node.exit().transition()
      .duration(this.duration)
      .attr('transform', (d: any) => `translate(${source.y},${source.x})`)
      .remove();

    nodeExit.select('circle')
      .attr('r', 1e-6);

    nodeExit.select('text')
      .style('fill-opacity', 1e-6);

    const link = this.svg.selectAll('path.link')
      .data(links, (d: any) => d.id);

    const linkEnter = link.enter().insert('path', 'g')
      .attr('class', 'link')
      .style('fill', 'none')
      .style('stroke', 'var(--mat-sys-outline)')
      .style('stroke-width', '1.5px')
      .attr('d', (d: any) => {
        const o = { x: source.x0, y: source.y0 };
        return this.diagonal(o, o);
      });

    const linkUpdate = linkEnter.merge(link);

    linkUpdate.transition()
      .duration(this.duration)
      .attr('d', (d: any) => this.diagonal(d, d.parent));

    link.exit().transition()
      .duration(this.duration)
      .attr('d', (d: any) => {
        const o = { x: source.x, y: source.y };
        return this.diagonal(o, o);
      })
      .remove();

    nodes.forEach((d: any) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  private diagonal(s: any, d: any) {
    return `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;
  }

  private click(event: any, d: any) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
    this.update(d);
  }
}
