"use client";

import { ArrowDown, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  PAGE_TYPE_COLORS,
  PAGE_TYPE_LABELS,
} from "@/features/workspace/page-types";
import {
  TIMELINE_CARD_HEIGHT,
  TIMELINE_DRAG_THRESHOLD,
  TIMELINE_GROW_BY,
  clampTimelineY,
  nextTrayClickY,
  parseStoredExtent,
  splitTimelinePages,
  timelineCanvasHeight,
  timelineExtentStorageKey,
  withTimelineY,
  withoutTimelineY,
  type TimelineSourcePage,
} from "@/features/relationships/timeline";

type RelationshipTimelineProps = {
  pages: TimelineSourcePage[];
  workspaceId?: string;
  onOpenPage: (pageId: string) => void;
  onCreateEvent: (y: number) => string;
  onUpdatePage: (
    pageId: string,
    patch: { title?: string; fields?: Record<string, string> },
  ) => void;
};

type CardDrag = {
  id: string;
  startClientY: number;
  startY: number;
  liveY: number;
  moved: boolean;
};

type TrayDrag = {
  id: string;
  originX: number;
  originY: number;
  x: number;
  y: number;
  moved: boolean;
};

function pointInRect(x: number, y: number, rect: DOMRect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function RelationshipTimeline({
  pages,
  workspaceId,
  onOpenPage,
  onCreateEvent,
  onUpdatePage,
}: RelationshipTimelineProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const titleFieldRef = useRef<HTMLInputElement>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [userExtent, setUserExtent] = useState(0);
  const [namingId, setNamingId] = useState<string | null>(null);
  const [cardDrag, setCardDrag] = useState<CardDrag | null>(null);
  const [trayDrag, setTrayDrag] = useState<TrayDrag | null>(null);
  const cardDragRef = useRef<CardDrag | null>(null);
  const trayDragRef = useRef<TrayDrag | null>(null);
  const { tray, placed } = useMemo(() => splitTimelinePages(pages), [pages]);
  const namingReady = Boolean(
    namingId && placed.some((page) => page.id === namingId),
  );
  const pagesById = useMemo(
    () => new Map(pages.map((page) => [page.id, page])),
    [pages],
  );
  const storageKey = timelineExtentStorageKey(workspaceId);
  const farthestY = placed.reduce(
    (max, page) => Math.max(max, page.timelineY),
    cardDrag ? cardDrag.liveY : 0,
  );
  const canvasHeight = timelineCanvasHeight({
    viewportHeight,
    farthestY,
    userExtent,
  });

  useEffect(() => {
    setUserExtent(parseStoredExtent(localStorage.getItem(storageKey)));
  }, [storageKey]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const observer = new ResizeObserver(() => {
      setViewportHeight(board.clientHeight);
    });
    observer.observe(board);
    setViewportHeight(board.clientHeight);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!namingReady) return;
    titleFieldRef.current?.focus();
    titleFieldRef.current?.select();
  }, [namingReady]);

  function persistExtent(next: number) {
    localStorage.setItem(storageKey, String(next));
  }

  function growToFit(y: number) {
    const needed = y + TIMELINE_CARD_HEIGHT + 160;
    setUserExtent((current) => {
      const next = Math.max(current, needed);
      persistExtent(next);
      return next;
    });
  }

  function canvasYFromClient(clientY: number) {
    const board = boardRef.current;
    if (!board) return 8;
    return clampTimelineY(clientY - board.getBoundingClientRect().top + board.scrollTop - 20);
  }

  function placePage(pageId: string, y: number) {
    const page = pagesById.get(pageId);
    if (!page) return;
    onUpdatePage(pageId, { fields: withTimelineY(page.fields, y) });
    growToFit(y);
  }

  function unplacePage(pageId: string) {
    const page = pagesById.get(pageId);
    if (!page) return;
    onUpdatePage(pageId, { fields: withoutTimelineY(page.fields) });
    if (namingId === pageId) setNamingId(null);
  }

  function startTrayDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    pageId: string,
  ) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = {
      id: pageId,
      originX: event.clientX,
      originY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    trayDragRef.current = next;
    setTrayDrag(next);
  }

  function moveTrayDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = trayDragRef.current;
    if (!current || current.id !== event.currentTarget.dataset.pageId) return;
    const next = {
      ...current,
      x: event.clientX,
      y: event.clientY,
      moved:
        current.moved ||
        Math.hypot(event.clientX - current.originX, event.clientY - current.originY) >
          TIMELINE_DRAG_THRESHOLD,
    };
    trayDragRef.current = next;
    setTrayDrag(next);
  }

  function endTrayDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = trayDragRef.current;
    trayDragRef.current = null;
    setTrayDrag(null);
    if (!drag || drag.id !== event.currentTarget.dataset.pageId) return;
    const board = boardRef.current;
    if (!drag.moved) {
      placePage(drag.id, nextTrayClickY(placed.map((page) => page.timelineY)));
      return;
    }
    if (board && pointInRect(event.clientX, event.clientY, board.getBoundingClientRect())) {
      placePage(drag.id, canvasYFromClient(event.clientY));
    }
  }

  function startCardDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    pageId: string,
    startY: number,
  ) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, input")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = {
      id: pageId,
      startClientY: event.clientY,
      startY,
      liveY: startY,
      moved: false,
    };
    cardDragRef.current = next;
    setCardDrag(next);
  }

  function moveCardDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const current = cardDragRef.current;
    if (!current || current.id !== event.currentTarget.dataset.pageId) return;
    const next = {
      ...current,
      liveY: clampTimelineY(current.startY + event.clientY - current.startClientY),
      moved:
        current.moved ||
        Math.abs(event.clientY - current.startClientY) > TIMELINE_DRAG_THRESHOLD,
    };
    cardDragRef.current = next;
    setCardDrag(next);
  }

  function endCardDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = cardDragRef.current;
    cardDragRef.current = null;
    setCardDrag(null);
    if (!drag || drag.id !== event.currentTarget.dataset.pageId) return;
    const tray = trayRef.current;
    if (
      drag.moved &&
      tray &&
      pointInRect(event.clientX, event.clientY, tray.getBoundingClientRect())
    ) {
      unplacePage(drag.id);
      return;
    }
    if (drag.moved) {
      placePage(drag.id, drag.liveY);
      return;
    }
    if (namingId !== drag.id) onOpenPage(drag.id);
  }

  function createEventAt(event: ReactMouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-timeline-card]")) return;
    const y = canvasYFromClient(event.clientY);
    const id = onCreateEvent(y);
    growToFit(y);
    setNamingId(id);
  }

  function finishNaming(pageId: string, title: string) {
    onUpdatePage(pageId, { title: title.trim() || "Untitled" });
    setNamingId(null);
  }

  return (
    <div className="relationship-timeline">
      <aside ref={trayRef} className="timeline-tray" aria-label="Unused chapters and events">
        <span className="eyebrow">NOT ON THE TIMELINE</span>
        {tray.length ? (
          <ul>
            {tray.map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  className="timeline-tray-item"
                  data-page-id={page.id}
                  onPointerDown={(event) => startTrayDrag(event, page.id)}
                  onPointerMove={moveTrayDrag}
                  onPointerUp={endTrayDrag}
                  onPointerCancel={() => {
                    trayDragRef.current = null;
                    setTrayDrag(null);
                  }}
                >
                  <i style={{ background: PAGE_TYPE_COLORS[page.pageType] }} />
                  <span>
                    <small>{PAGE_TYPE_LABELS[page.pageType]}</small>
                    <strong>{page.title || "Untitled"}</strong>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Chapters and events you add appear here until you place them.</p>
        )}
      </aside>
      <div
        ref={boardRef}
        className="timeline-board"
        aria-label="Story timeline"
        onScroll={(event) => {
          const board = event.currentTarget;
          if (board.scrollHeight - board.scrollTop - board.clientHeight >= 64) {
            return;
          }
          setUserExtent((current) => {
            const next = Math.max(current, canvasHeight) + TIMELINE_GROW_BY;
            persistExtent(next);
            return next;
          });
        }}
      >
        <div
          className="timeline-extent"
          style={{ height: canvasHeight }}
          onDoubleClick={createEventAt}
        >
          <div className="timeline-spine" />
          <div className="timeline-time" aria-hidden="true">
            <ArrowDown size={18} />
            <span>Time</span>
          </div>
          {placed.map((page) => {
            const y = cardDrag?.id === page.id ? cardDrag.liveY : page.timelineY;
            return (
              <div
                key={page.id}
                data-timeline-card
                data-page-id={page.id}
                className={`timeline-card${cardDrag?.id === page.id ? " dragging" : ""}`}
                style={{
                  top: y,
                  borderColor: PAGE_TYPE_COLORS[page.pageType],
                }}
                onPointerDown={(event) => startCardDrag(event, page.id, y)}
                onPointerMove={moveCardDrag}
                onPointerUp={endCardDrag}
                onPointerCancel={() => {
                  cardDragRef.current = null;
                  setCardDrag(null);
                }}
              >
                <i style={{ background: PAGE_TYPE_COLORS[page.pageType] }} />
                <div>
                  <small>{PAGE_TYPE_LABELS[page.pageType]}</small>
                  {namingId === page.id ? (
                    <input
                      ref={titleFieldRef}
                      className="timeline-title-field"
                      defaultValue={page.title === "Untitled" ? "" : page.title}
                      placeholder="Untitled"
                      aria-label="Event title"
                      onPointerDown={(event) => event.stopPropagation()}
                      onBlur={(event) => finishNaming(page.id, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") setNamingId(null);
                      }}
                    />
                  ) : (
                    <strong>{page.title || "Untitled"}</strong>
                  )}
                </div>
                <button
                  type="button"
                  className="timeline-card-remove"
                  aria-label={`Remove ${page.title || "Untitled"} from the timeline`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => unplacePage(page.id)}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {trayDrag?.moved && (
        <div
          className="timeline-drag-ghost"
          style={{ left: trayDrag.x + 10, top: trayDrag.y + 10 }}
        >
          {pagesById.get(trayDrag.id)?.title || "Untitled"}
        </div>
      )}
    </div>
  );
}
