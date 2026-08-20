export const CHAPTER_EVENT_TYPE = "chapter-event";

export function chapterEventMarkerHtml(eventId: string) {
  return `<div data-type="${CHAPTER_EVENT_TYPE}" data-event-id="${eventId}"></div>`;
}

export function eventIdsInChapterHtml(html: string) {
  const ids: string[] = [];
  const pattern = /data-type="chapter-event"[^>]*data-event-id="([^"]+)"|data-event-id="([^"]+)"[^>]*data-type="chapter-event"/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const id = match[1] || match[2];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function insertChapterEventMarker(html: string, eventId: string) {
  if (eventIdsInChapterHtml(html).includes(eventId)) return html;
  const marker = chapterEventMarkerHtml(eventId);
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<p></p>") return marker;
  return `${html}${marker}`;
}

export function removeChapterEventMarker(html: string, eventId: string) {
  const escaped = eventId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html
    .replace(
      new RegExp(
        `<div[^>]*data-event-id="${escaped}"[^>]*>\\s*</div>`,
        "gi",
      ),
      "",
    )
    .replace(
      new RegExp(`<div[^>]*data-event-id="${escaped}"[^>]*/>`, "gi"),
      "",
    );
}

export function syncChapterEventMarkers(html: string, eventIds: string[]) {
  let next = html;
  for (const id of eventIdsInChapterHtml(html)) {
    if (!eventIds.includes(id)) next = removeChapterEventMarker(next, id);
  }
  for (const id of eventIds) {
    next = insertChapterEventMarker(next, id);
  }
  return next;
}

export function expandChapterEventMarkers(
  html: string,
  events: { id: string; content: string }[],
) {
  const byId = new Map(events.map((event) => [event.id, event]));
  return html.replace(
    /<div\b[^>]*data-type="chapter-event"[^>]*(?:\s*\/>|>\s*<\/div>)/gi,
    (tag) => {
      const eventId = tag.match(/data-event-id="([^"]+)"/i)?.[1];
      if (!eventId) return "";
      const event = byId.get(eventId);
      if (!event) return "";
      return event.content?.trim() || "";
    },
  );
}

export function chapterEventChildren<
  T extends {
    id: string;
    parentId: string | null;
    pageType: string;
    content?: string;
  },
>(pages: T[], chapterId: string) {
  const nested = pages.filter(
    (page) => page.parentId === chapterId && page.pageType === "event",
  );
  const order = eventIdsInChapterHtml(
    pages.find((page) => page.id === chapterId)?.content ?? "",
  );
  if (order.length === 0) return nested;
  return [...nested].sort((left, right) => {
    const leftIndex = order.indexOf(left.id);
    const rightIndex = order.indexOf(right.id);
    if (leftIndex === -1 && rightIndex === -1) return 0;
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function isChapterNestedEvent<
  T extends { id: string; parentId: string | null; pageType: string },
>(pages: T[], page: T) {
  if (page.pageType !== "event" || !page.parentId) return false;
  return (
    pages.find((candidate) => candidate.id === page.parentId)?.pageType ===
    "chapter"
  );
}
