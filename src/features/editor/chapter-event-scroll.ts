import { CHAPTER_EVENT_TYPE } from "./chapter-events";

export const DRAG_SCROLL_EDGE = 88;
export const DRAG_SCROLL_MAX_SPEED = 28;

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
  let top = pane.top;
  for (const selector of [".topbar", ".editor-toolbar"]) {
    const chrome = scroller.querySelector(selector);
    if (chrome) top = Math.max(top, chrome.getBoundingClientRect().bottom);
  }
  return { top, bottom: pane.bottom };
}

export function watchChapterEventDragScroll() {
  const onDragStart = (event: DragEvent) => {
    const origin = event.target;
    if (!(origin instanceof Element)) return;
    if (!origin.closest(`[data-type="${CHAPTER_EVENT_TYPE}"]`)) return;

    const scroller =
      origin.closest(".document-pane") ?? closestVerticalScroller(origin);
    if (!scroller) return;

    let y = event.clientY;
    let active = true;

    const onDragOver = (next: DragEvent) => {
      y = next.clientY;
    };
    const stop = () => {
      active = false;
      document.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("dragend", stop);
      window.removeEventListener("drop", stop);
    };

    document.addEventListener("dragover", onDragOver, true);
    window.addEventListener("dragend", stop);
    window.addEventListener("drop", stop);

    const tick = () => {
      if (!active) return;
      const { top, bottom } = writingScrollBounds(scroller);
      const delta = dragScrollDelta(y, top, bottom);
      if (delta) scroller.scrollTop += delta;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  document.addEventListener("dragstart", onDragStart, true);
  return () => document.removeEventListener("dragstart", onDragStart, true);
}
