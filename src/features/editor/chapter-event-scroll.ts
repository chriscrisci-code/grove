import { CHAPTER_EVENT_TYPE } from "./chapter-events";
import { SCRIPT_EVENT_TYPE } from "./script-events";

export const DRAG_SCROLL_EDGE = 160;
export const DRAG_SCROLL_MAX_SPEED = 32;

export function dragScrollDelta(
  clientY: number,
  top: number,
  bottom: number,
  edge = DRAG_SCROLL_EDGE,
  maxSpeed = DRAG_SCROLL_MAX_SPEED,
) {
  if (bottom <= top) return 0;
  if (clientY <= top) {
    return -maxSpeed;
  }
  if (clientY >= bottom) {
    return maxSpeed;
  }
  if (clientY < top + edge) {
    return -Math.max(2, Math.round(((top + edge - clientY) / edge) * maxSpeed));
  }
  if (clientY > bottom - edge) {
    return Math.max(
      2,
      Math.round(((clientY - (bottom - edge)) / edge) * maxSpeed),
    );
  }
  return 0;
}

export function closestVerticalScroller(start: Element | null) {
  let current: Element | null = start;
  while (current && current !== document.documentElement) {
    if (current instanceof HTMLElement) {
      const overflowY = getComputedStyle(current).overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        current.scrollHeight > current.clientHeight + 1
      ) {
        return current;
      }
    }
    current = current.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

export function writingScrollBounds(scroller: HTMLElement) {
  const pane = scroller.getBoundingClientRect();
  return { top: pane.top, bottom: pane.bottom };
}

export function readDragClientY(event: DragEvent, fallback: number) {
  if (event.clientY === 0 && event.clientX === 0) return fallback;
  return event.clientY;
}

export const CHAPTER_EVENT_DRAGGING_CLASS = "dragging-chapter-event";

export function isChapterEventDragging() {
  return document.body.classList.contains(CHAPTER_EVENT_DRAGGING_CLASS);
}

export function watchChapterEventDragScroll() {
  const onDragStart = (event: DragEvent) => {
    const origin = event.target;
    if (!(origin instanceof Element)) return;
    if (
      !origin.closest(
        `[data-type="${CHAPTER_EVENT_TYPE}"], [data-type="${SCRIPT_EVENT_TYPE}"]`,
      )
    ) {
      return;
    }

    const found =
      origin.closest(".document-pane") ?? closestVerticalScroller(origin);
    if (!(found instanceof HTMLElement)) return;
    const scroller = found;

    let y = event.clientY;
    let active = true;
    let releaseTimer = 0;
    let scrollTimer = 0;
    document.body.classList.add(CHAPTER_EVENT_DRAGGING_CLASS);

    const trackY = (next: DragEvent) => {
      y = readDragClientY(next, y);
    };
    const onDragOver = (next: DragEvent) => {
      next.preventDefault();
      trackY(next);
    };
    const swallowClick = (click: Event) => {
      if (!isChapterEventDragging()) return;
      click.preventDefault();
      click.stopPropagation();
    };
    const stop = () => {
      active = false;
      window.clearInterval(scrollTimer);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("drag", trackY, true);
      window.removeEventListener("dragend", stop);
      window.removeEventListener("drop", stop);
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        document.removeEventListener("click", swallowClick, true);
        document.body.classList.remove(CHAPTER_EVENT_DRAGGING_CLASS);
      }, 400);
    };

    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("drag", trackY, true);
    document.addEventListener("click", swallowClick, true);
    window.addEventListener("dragend", stop);
    window.addEventListener("drop", stop);

    scrollTimer = window.setInterval(() => {
      if (!active) return;
      const { top, bottom } = writingScrollBounds(scroller);
      const delta = dragScrollDelta(y, top, bottom);
      if (delta) scroller.scrollTop += delta;
    }, 16);
  };

  document.addEventListener("dragstart", onDragStart, true);
  return () => {
    document.body.classList.remove(CHAPTER_EVENT_DRAGGING_CLASS);
    document.removeEventListener("dragstart", onDragStart, true);
  };
}
