export const SCRIPT_EVENT_TYPE = "script-event";

export function scriptEventMarkerHtml(eventId: string) {
  return `<div data-type="${SCRIPT_EVENT_TYPE}" data-event-id="${eventId}"></div>`;
}

export function eventIdsInScriptHtml(html: string) {
  const ids: string[] = [];
  const pattern =
    /data-type="script-event"[^>]*data-event-id="([^"]+)"|data-event-id="([^"]+)"[^>]*data-type="script-event"/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const id = match[1] || match[2];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function insertScriptEventMarker(html: string, eventId: string) {
  if (eventIdsInScriptHtml(html).includes(eventId)) return html;
  const marker = scriptEventMarkerHtml(eventId);
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<p></p>" || trimmed === '<p data-script="action"></p>') {
    return marker;
  }
  return `${html}${marker}`;
}

export function removeScriptEventMarker(html: string, eventId: string) {
  const escaped = eventId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html
    .replace(
      new RegExp(`<div[^>]*data-event-id="${escaped}"[^>]*>\\s*</div>`, "gi"),
      "",
    )
    .replace(
      new RegExp(`<div[^>]*data-event-id="${escaped}"[^>]*/>`, "gi"),
      "",
    );
}

export function syncScriptEventMarkers(html: string, eventIds: string[]) {
  let next = html;
  for (const id of eventIdsInScriptHtml(html)) {
    if (!eventIds.includes(id)) next = removeScriptEventMarker(next, id);
  }
  for (const id of eventIds) {
    next = insertScriptEventMarker(next, id);
  }
  return next;
}

export function expandScriptEventMarkers(
  html: string,
  events: { id: string; content: string }[],
) {
  const byId = new Map(events.map((event) => [event.id, event]));
  return html.replace(
    /<div\b[^>]*data-type="script-event"[^>]*(?:\s*\/>|>\s*<\/div>)/gi,
    (tag) => {
      const eventId = tag.match(/data-event-id="([^"]+)"/i)?.[1];
      if (!eventId) return "";
      const event = byId.get(eventId);
      if (!event) return "";
      return event.content?.trim() || "";
    },
  );
}

export function scriptEventChildren<
  T extends {
    id: string;
    parentId: string | null;
    pageType: string;
    content?: string;
  },
>(pages: T[], scriptId: string) {
  const nested = pages.filter(
    (page) => page.parentId === scriptId && page.pageType === "script_event",
  );
  const order = eventIdsInScriptHtml(
    pages.find((page) => page.id === scriptId)?.content ?? "",
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

export function isScriptNestedEvent<
  T extends { id: string; parentId: string | null; pageType: string },
>(pages: T[], page: T) {
  if (page.pageType !== "script_event" || !page.parentId) return false;
  return (
    pages.find((candidate) => candidate.id === page.parentId)?.pageType ===
    "script"
  );
}
