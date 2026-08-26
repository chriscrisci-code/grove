import type { PageType } from "@/features/workspace/page-types";

export const TIMELINE_Y_FIELD = "timelineY";
export const TIMELINE_LANE_FIELD = "timelineLane";
export const TIMELINE_LANE_COUNT = 6;
export const TIMELINE_GUTTER = 56;
export const TIMELINE_LANE_COLORS = [
  "#c45c5c",
  "#d48a3a",
  "#c9b24a",
  "#5a9a62",
  "#4a7f9e",
  "#7a5a9a",
] as const;
export const TIMELINE_CARD_HEIGHT = 29;
export const TIMELINE_CARD_GAP = 56;
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
): value is "chapter" | "event" | "script" | "script_event" {
  return (
    value === "chapter" ||
    value === "event" ||
    value === "script" ||
    value === "script_event"
  );
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

export function clampTimelineLane(lane: number): number {
  if (!Number.isFinite(lane)) return 0;
  return Math.min(TIMELINE_LANE_COUNT - 1, Math.max(0, Math.round(lane)));
}

export function parseTimelineLane(value: string | undefined): number {
  if (value == null || value === "") return 0;
  return clampTimelineLane(Number(value));
}

export function serializeTimelineLane(lane: number): string {
  return String(clampTimelineLane(lane));
}

export function snapTimelineLane(x: number, usableWidth: number): number {
  if (usableWidth <= 0) return 0;
  return clampTimelineLane(
    Math.floor(x / (usableWidth / TIMELINE_LANE_COUNT)),
  );
}

export function timelineLaneCenter(lane: number, usableWidth: number): number {
  return (clampTimelineLane(lane) + 0.5) * (usableWidth / TIMELINE_LANE_COUNT);
}

export function timelineCardWidth(usableWidth: number, boardWidth: number): number {
  const laneWidth = usableWidth / TIMELINE_LANE_COUNT;
  const full = Math.min(Math.max(laneWidth * 2.55, 144), boardWidth * 0.75);
  return full * 0.75;
}

export function timelineCardLeft(
  lane: number,
  usableWidth: number,
  boardWidth: number,
  cardWidth: number,
) {
  const center = TIMELINE_GUTTER + timelineLaneCenter(lane, usableWidth);
  return Math.min(
    Math.max(8, center - cardWidth / 2),
    Math.max(8, boardWidth - cardWidth - 8),
  );
}

export function timelineSnapOffset(
  lane: number,
  cardLeft: number,
  cardWidth: number,
  usableWidth: number,
) {
  const laneX = TIMELINE_GUTTER + timelineLaneCenter(lane, usableWidth);
  const inset = 6;
  return Math.min(cardWidth - inset, Math.max(inset, laneX - cardLeft));
}

export function withTimelineY(
  fields: Record<string, string>,
  y: number,
  lane?: number,
): Record<string, string> {
  return {
    ...fields,
    [TIMELINE_Y_FIELD]: serializeTimelineY(y),
    [TIMELINE_LANE_FIELD]: serializeTimelineLane(
      lane ?? parseTimelineLane(fields[TIMELINE_LANE_FIELD]),
    ),
  };
}

export function withoutTimelineY(
  fields: Record<string, string>,
): Record<string, string> {
  if (!(TIMELINE_Y_FIELD in fields) && !(TIMELINE_LANE_FIELD in fields)) {
    return fields;
  }
  const next = { ...fields };
  delete next[TIMELINE_Y_FIELD];
  delete next[TIMELINE_LANE_FIELD];
  return next;
}

export function splitTimelinePages<
  T extends { pageType: string; fields: Record<string, string> },
>(pages: T[]) {
  const tray: T[] = [];
  const placed: Array<T & { timelineY: number; timelineLane: number }> = [];
  for (const page of pages) {
    if (!isTimelinePageType(page.pageType)) continue;
    const timelineY = parseTimelineY(page.fields[TIMELINE_Y_FIELD]);
    if (timelineY == null) tray.push(page);
    else {
      placed.push({
        ...page,
        timelineY,
        timelineLane: parseTimelineLane(page.fields[TIMELINE_LANE_FIELD]),
      });
    }
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
