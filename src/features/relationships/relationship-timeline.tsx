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
  TIMELINE_GUTTER,
  TIMELINE_LANE_COLORS,
  clampTimelineY,
  nextTrayClickY,
  parseStoredExtent,
  snapTimelineLane,
  splitTimelinePages,
  timelineCanvasHeight,
  timelineCardWidth,
  timelineExtentStorageKey,
  timelineLaneCenter,
  withTimelineY,
  withoutTimelineY,
  type TimelineSourcePage,
} from "@/features/relationships/timeline";

type RelationshipTimelineProps = {
  pages: TimelineSourcePage[];
  workspaceId?: string;
  onOpenPage: (pageId: string) => void;
  onCreateEvent: (y: number, lane: number) => string;
  onUpdatePage: (
    pageId: string,
    patch: { title?: string; fields?: Record<string, string> },
  ) => void;
};

type CardDrag = {
  id: string;
  startClientX: number;
  startClientY: number;
  startY: number;
  startLane: number;
  liveY: number;
  liveLane: number;
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
  const titleFieldRef = useRef<HTMLTextAreaElement>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [boardWidth, setBoardWidth] = useState(0);
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
      setBoardWidth(board.clientWidth);
    });
    observer.observe(board);
    setViewportHeight(board.clientHeight);
    setBoardWidth(board.clientWidth);
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

  const usableWidth = Math.max(0, boardWidth - TIMELINE_GUTTER);
  const cardWidth = timelineCardWidth(usableWidth, boardWidth || 1);

  function canvasYFromClient(clientY: number) {
    const board = boardRef.current;
    if (!board) return 8;
    return clampTimelineY(clientY - board.getBoundingClientRect().top + board.scrollTop - 16);
  }

  function canvasLaneFromClient(clientX: number) {
    const board = boardRef.current;
    if (!board) return 0;
    return snapTimelineLane(
      clientX - board.getBoundingClientRect().left - TIMELINE_GUTTER,
      usableWidth,
    );
  }

  function cardLeft(lane: number) {
    const center = TIMELINE_GUTTER + timelineLaneCenter(lane, usableWidth || 1);
    return Math.min(
      Math.max(8, center - cardWidth / 2),
      Math.max(8, boardWidth - cardWidth - 8),
    );
  }

  function placePage(pageId: string, y: number, lane?: number) {
    const page = pagesById.get(pageId);
    if (!page) return;
    onUpdatePage(pageId, { fields: withTimelineY(page.fields, y, lane) });
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
      placePage(drag.id, nextTrayClickY(placed.map((page) => page.timelineY)), 2);
      return;
    }
    if (board && pointInRect(event.clientX, event.clientY, board.getBoundingClientRect())) {
      placePage(
        drag.id,
        canvasYFromClient(event.clientY),
        canvasLaneFromClient(event.clientX),
      );
    }
  }

  function startCardDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    pageId: string,
    startY: number,
    startLane: number,
  ) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, input")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = {
      id: pageId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startY,
      startLane,
      liveY: startY,
      liveLane: startLane,
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
      liveLane: canvasLaneFromClient(event.clientX),
      moved:
        current.moved ||
        Math.hypot(
          event.clientX - current.startClientX,
          event.clientY - current.startClientY,
        ) > TIMELINE_DRAG_THRESHOLD,
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
      placePage(drag.id, drag.liveY, drag.liveLane);
      return;
    }
    if (namingId !== drag.id) onOpenPage(drag.id);
  }

  function createEventAt(event: ReactMouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-timeline-card]")) return;
    const y = canvasYFromClient(event.clientY);
    const lane = canvasLaneFromClient(event.clientX);
    const id = onCreateEvent(y, lane);
    growToFit(y);
    setNamingId(id);
  }

  function finishNaming(pageId: string, title: string) {
    onUpdatePage(pageId, {
      title: title.replace(/\s*\n+\s*/g, " ").trim() || "Untitled",
    });
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
          {TIMELINE_LANE_COLORS.map((color, lane) => (
            <div
              key={color}
              className="timeline-lane"
              style={{
                left: TIMELINE_GUTTER + timelineLaneCenter(lane, usableWidth || 1),
                background: color,
              }}
            />
          ))}
          <div className="timeline-time" aria-hidden="true">
            <ArrowDown size={18} />
            <span>Time</span>
          </div>
          {placed.map((page) => {
            const y = cardDrag?.id === page.id ? cardDrag.liveY : page.timelineY;
            const lane =
              cardDrag?.id === page.id ? cardDrag.liveLane : page.timelineLane;
            return (
              <div
                key={page.id}
                data-timeline-card
                data-page-id={page.id}
                className={`timeline-card${cardDrag?.id === page.id ? " dragging" : ""}`}
                style={{
                  top: y,
                  left: cardLeft(lane),
                  width: cardWidth,
                  borderColor: PAGE_TYPE_COLORS[page.pageType],
                }}
                onPointerDown={(event) => startCardDrag(event, page.id, y, lane)}
                onPointerMove={moveCardDrag}
                onPointerUp={endCardDrag}
                onPointerCancel={() => {
                  cardDragRef.current = null;
                  setCardDrag(null);
                }}
              >
                <span
                  className="timeline-card-snap"
                  style={{ background: TIMELINE_LANE_COLORS[lane] }}
                  aria-hidden="true"
                />
                <i style={{ background: PAGE_TYPE_COLORS[page.pageType] }} />
                <div>
                  <small>{PAGE_TYPE_LABELS[page.pageType]}</small>
                  {namingId === page.id ? (
                    <textarea
                      ref={titleFieldRef}
                      className="timeline-title-field"
                      rows={1}
                      defaultValue={page.title === "Untitled" ? "" : page.title}
                      placeholder="Untitled"
                      aria-label="Event title"
                      onPointerDown={(event) => event.stopPropagation()}
                      onBlur={(event) => finishNaming(page.id, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
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
