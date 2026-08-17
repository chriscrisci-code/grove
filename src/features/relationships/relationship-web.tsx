"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  PAGE_TYPE_COLORS,
  PAGE_TYPE_LABELS,
  type PageType,
  type StoryRelationship,
} from "@/features/workspace/page-types";
import {
  WEB_CANVAS_HEIGHT,
  WEB_CANVAS_WIDTH,
  WEB_DRAG_THRESHOLD,
  defaultWebPosition,
  webPositionFromFields,
  withWebPosition,
} from "@/features/relationships/web-layout";

type WebPage = {
  id: string;
  title: string;
  pageType: PageType;
  fields: Record<string, string>;
};

type RelationshipWebProps = {
  pages: WebPage[];
  relationships: StoryRelationship[];
  onOpenPage: (pageId: string) => void;
  onUpdatePage: (
    pageId: string,
    patch: { fields?: Record<string, string> },
  ) => void;
};

type NodeDrag = {
  id: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
  moved: boolean;
};

export function RelationshipWeb({
  pages,
  relationships,
  onOpenPage,
  onUpdatePage,
}: RelationshipWebProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(
    null,
  );
  const dragRef = useRef<NodeDrag | null>(null);
  const [drag, setDrag] = useState<NodeDrag | null>(null);
  const width = WEB_CANVAS_WIDTH;
  const height = WEB_CANVAS_HEIGHT;
  const layout = useMemo(
    () =>
      pages.map((page, index) => {
        const saved = webPositionFromFields(page.fields);
        const live = drag?.id === page.id ? { x: drag.x, y: drag.y } : null;
        return {
          ...page,
          ...(live ?? saved ?? defaultWebPosition(index)),
        };
      }),
    [drag, pages],
  );
  const byId = useMemo(
    () => new Map(layout.map((page) => [page.id, page])),
    [layout],
  );

  function svgScale() {
    const svg = svgRef.current;
    if (!svg) return { x: 1, y: 1 };
    const rect = svg.getBoundingClientRect();
    return {
      x: rect.width ? width / rect.width : 1,
      y: rect.height ? height / rect.height : 1,
    };
  }

  function startPan(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget) return;
    panRef.current = {
      x: offset.x,
      y: offset.y,
      originX: event.clientX,
      originY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: ReactPointerEvent<SVGSVGElement>) {
    const pan = panRef.current;
    if (!pan) return;
    setOffset({
      x: pan.x + event.clientX - pan.originX,
      y: pan.y + event.clientY - pan.originY,
    });
  }

  function endPan() {
    panRef.current = null;
  }

  function startNodeDrag(
    event: ReactPointerEvent<SVGGElement>,
    pageId: string,
    x: number,
    y: number,
  ) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = {
      id: pageId,
      startX: x,
      startY: y,
      x,
      y,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    };
    dragRef.current = next;
    setDrag(next);
  }

  function moveNodeDrag(event: ReactPointerEvent<SVGGElement>) {
    const current = dragRef.current;
    if (!current || current.id !== event.currentTarget.dataset.pageId) return;
    event.stopPropagation();
    const scale = svgScale();
    const next = {
      ...current,
      x: current.startX + (event.clientX - current.originX) * scale.x,
      y: current.startY + (event.clientY - current.originY) * scale.y,
      moved:
        current.moved ||
        Math.hypot(event.clientX - current.originX, event.clientY - current.originY) >
          WEB_DRAG_THRESHOLD,
    };
    dragRef.current = next;
    setDrag(next);
  }

  function endNodeDrag(event: ReactPointerEvent<SVGGElement>) {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current || current.id !== event.currentTarget.dataset.pageId) return;
    event.stopPropagation();
    if (current.moved) {
      const page = pages.find((item) => item.id === current.id);
      if (page) {
        onUpdatePage(current.id, {
          fields: withWebPosition(page.fields, current.x, current.y),
        });
      }
      return;
    }
    onOpenPage(current.id);
  }

  if (pages.length === 0) {
    return (
      <p className="relationship-empty">Create a page to see it on the web.</p>
    );
  }

  return (
    <svg
      ref={svgRef}
      className="relationship-canvas"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Story relationship web"
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <g transform={`translate(${offset.x} ${offset.y})`}>
        {relationships.map((item) => {
          const from = byId.get(item.fromPageId);
          const to = byId.get(item.toPageId);
          if (!from || !to) return null;
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          return (
            <g key={item.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="relationship-edge"
              />
              <text x={midX} y={midY - 8} className="relationship-edge-label">
                {item.label}
              </text>
            </g>
          );
        })}
        {layout.map((page) => (
          <g
            key={page.id}
            data-page-id={page.id}
            className={`relationship-node${drag?.id === page.id ? " dragging" : ""}`}
            transform={`translate(${page.x} ${page.y})`}
            onPointerDown={(event) => startNodeDrag(event, page.id, page.x, page.y)}
            onPointerMove={moveNodeDrag}
            onPointerUp={endNodeDrag}
            onPointerCancel={() => {
              dragRef.current = null;
              setDrag(null);
            }}
          >
            <circle r="28" fill={PAGE_TYPE_COLORS[page.pageType]} />
            <text y="4">{(page.title || "Untitled").slice(0, 12)}</text>
            <title>
              {page.title || "Untitled"} · {PAGE_TYPE_LABELS[page.pageType]}
            </title>
          </g>
        ))}
      </g>
    </svg>
  );
}
