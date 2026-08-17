"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  PAGE_TYPE_COLORS,
  PAGE_TYPE_LABELS,
  type PageType,
  type StoryRelationship,
} from "@/features/workspace/page-types";

type WebPage = {
  id: string;
  title: string;
  pageType: PageType;
};

type RelationshipWebProps = {
  pages: WebPage[];
  relationships: StoryRelationship[];
  onOpenPage: (pageId: string) => void;
};

export function RelationshipWeb({
  pages,
  relationships,
  onOpenPage,
}: RelationshipWebProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(
    null,
  );
  const width = 920;
  const height = 640;
  const layout = useMemo(() => {
    const radius = Math.min(width, height) / 2 - 88;
    const centerX = width / 2;
    const centerY = height / 2;
    return pages.map((page, index) => {
      const angle = pages.length
        ? (Math.PI * 2 * index) / pages.length - Math.PI / 2
        : 0;
      return {
        ...page,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });
  }, [pages]);
  const byId = useMemo(
    () => new Map(layout.map((page) => [page.id, page])),
    [layout],
  );

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

  if (pages.length === 0) {
    return (
      <p className="relationship-empty">Create a page to see it on the web.</p>
    );
  }

  return (
    <svg
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
            className="relationship-node"
            transform={`translate(${page.x} ${page.y})`}
            onClick={() => onOpenPage(page.id)}
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
