import type { PageType } from "@/features/workspace/page-types";

export const TIMELINE_Y_FIELD = "timelineY";
export const TIMELINE_CARD_HEIGHT = 56;
export const TIMELINE_CARD_GAP = 72;
export const TIMELINE_DEFAULT_Y = 48;
export const TIMELINE_MIN_EXTENT = 640;
export const TIMELINE_GROW_BY = 400;
export const TIMELINE_BOTTOM_PAD = 160;
export const TIMELINE_DRAG_THRESHOLD = 5;

export type TimelineSourcePage = {
  id: string;
  title: string;
  pageType: PageType;
  fields: Record<string, string>;
};

export function isTimelinePageType(
  value: string,
): value is "chapter" | "event" {
  return value === "chapter" || value === "event";
}

export function parseTimelineY(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const y = Number(value);
  return Number.isFinite(y) ? y : null;
}

export function clampTimelineY(y: number): number {
  return Math.max(8, y);
}

export function serializeTimelineY(y: number): string {
  return String(Math.round(clampTimelineY(y)));
}

export function withTimelineY(
  fields: Record<string, string>,
  y: number,
): Record<string, string> {
  return { ...fields, [TIMELINE_Y_FIELD]: serializeTimelineY(y) };
}

export function withoutTimelineY(
  fields: Record<string, string>,
): Record<string, string> {
  if (!(TIMELINE_Y_FIELD in fields)) return fields;
  const next = { ...fields };
  delete next[TIMELINE_Y_FIELD];
  return next;
}

export function splitTimelinePages<
  T extends { pageType: string; fields: Record<string, string> },
>(pages: T[]) {
  const tray: T[] = [];
  const placed: Array<T & { timelineY: number }> = [];
  for (const page of pages) {
    if (!isTimelinePageType(page.pageType)) continue;
    const timelineY = parseTimelineY(page.fields[TIMELINE_Y_FIELD]);
    if (timelineY == null) tray.push(page);
    else placed.push({ ...page, timelineY });
  }
  placed.sort((left, right) => left.timelineY - right.timelineY);
  return { tray, placed };
}

export function nextTrayClickY(placedYs: number[]): number {
  if (!placedYs.length) return TIMELINE_DEFAULT_Y;
  return Math.max(...placedYs) + TIMELINE_CARD_GAP;
}

export function timelineCanvasHeight({
  viewportHeight,
  farthestY,
  userExtent,
}: {
  viewportHeight: number;
  farthestY: number;
  userExtent: number;
}): number {
  const content =
    farthestY > 0
      ? farthestY + TIMELINE_CARD_HEIGHT + TIMELINE_BOTTOM_PAD
      : TIMELINE_MIN_EXTENT;
  return Math.max(TIMELINE_MIN_EXTENT, viewportHeight, content, userExtent);
}

export function timelineExtentStorageKey(workspaceId?: string): string {
  return workspaceId
    ? `storytree-timeline-extent:${workspaceId}`
    : "storytree-timeline-extent";
}

export function parseStoredExtent(value: string | null): number {
  if (!value) return 0;
  const extent = Number(value);
  return Number.isFinite(extent) && extent > 0 ? extent : 0;
}
