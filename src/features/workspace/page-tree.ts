export type TreePage = {
  id: string;
  parentId: string | null;
  pageType?: string;
};

export type PageDrop =
  | { type: "inside"; targetId: string }
  | { type: "root" }
  | { type: "before"; targetId: string }
  | { type: "after"; targetId: string };

export function dropTargetId(drop: PageDrop | null) {
  return drop && drop.type !== "root" ? drop.targetId : null;
}

export function isDescendantOf<T extends TreePage>(
  pages: T[],
  ancestorId: string,
  nodeId: string,
) {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const seen = new Set<string>();
  let current = byId.get(nodeId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    if (seen.has(current.id)) break;
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return false;
}

export function dropPlacementFromOffset(offsetRatio: number): "before" | "after" {
  return offsetRatio < 0.5 ? "before" : "after";
}

export function pageTitleSortValue(title: string) {
  return title.trim() || "Untitled";
}

export function comparePageTitles(a: string, b: string) {
  return pageTitleSortValue(a).localeCompare(pageTitleSortValue(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortPagesByTitle<T extends { title: string }>(pages: T[]) {
  return [...pages].sort((left, right) =>
    comparePageTitles(left.title, right.title),
  );
}

export function siblingPages<T extends TreePage & { title: string }>(
  pages: T[],
  parentId: string | null,
) {
  return sortPagesByTitle(pages.filter((page) => page.parentId === parentId));
}

export function filterStoryPages<
  T extends TreePage & { title: string; pageType: string },
>(
  pages: T[],
  options: { types?: readonly string[]; query?: string } = {},
) {
  const types = options.types ?? [];
  const query = options.query?.trim().toLowerCase() ?? "";
  const matchesSelf = (page: T) => {
    if (types.length > 0 && !types.includes(page.pageType)) return false;
    if (query && !page.title.toLowerCase().includes(query)) return false;
    return true;
  };

  const childrenOf = new Map<string | null, T[]>();
  for (const page of pages) {
    const list = childrenOf.get(page.parentId) ?? [];
    list.push(page);
    childrenOf.set(page.parentId, list);
  }

  const memo = new Map<string, boolean>();
  function subtreeMatches(page: T): boolean {
    const cached = memo.get(page.id);
    if (cached !== undefined) return cached;
    if (matchesSelf(page)) {
      memo.set(page.id, true);
      return true;
    }
    const found = (childrenOf.get(page.id) ?? []).some((child) =>
      subtreeMatches(child),
    );
    memo.set(page.id, found);
    return found;
  }

  return pages.filter((page) => subtreeMatches(page));
}

export function applyPageDrop<T extends TreePage>(
  pages: T[],
  draggedId: string,
  drop: PageDrop,
): T[] | null {
  const dragged = pages.find((page) => page.id === draggedId);
  if (!dragged) return null;

  let newParentId: string | null;
  if (drop.type === "root") {
    if (dragged.parentId === null) return null;
    newParentId = null;
  } else if (drop.type === "inside") {
    const target = pages.find((page) => page.id === drop.targetId);
    if (!target || draggedId === drop.targetId) return null;
    if (isDescendantOf(pages, draggedId, drop.targetId)) return null;
    if (dragged.parentId === target.id) return null;
    if (target.pageType === "script") {
      if (dragged.pageType !== "script_event") return null;
    } else if (target.pageType === "chapter" && dragged.pageType !== "event") {
      return null;
    }
    newParentId = target.id;
  } else {
    return null;
  }

  if (newParentId === draggedId) return null;
  if (newParentId && isDescendantOf(pages, draggedId, newParentId)) return null;

  return pages.map((page) =>
    page.id === draggedId ? { ...page, parentId: newParentId } : page,
  );
}

export function reorderAmong<T extends { id: string }>(
  pages: T[],
  inGroup: (page: T) => boolean,
  draggedId: string,
  beforeId: string | null,
): T[] {
  const dragged = pages.find((page) => page.id === draggedId);
  if (!dragged || !inGroup(dragged)) return pages;
  const remaining = pages.filter((page) => page.id !== draggedId);
  const groupIds = remaining.filter(inGroup).map((page) => page.id);
  const nextIds = [...groupIds];
  const insertIndex = beforeId ? nextIds.indexOf(beforeId) : -1;
  if (insertIndex >= 0) nextIds.splice(insertIndex, 0, draggedId);
  else nextIds.push(draggedId);

  const byId = new Map(pages.map((page) => [page.id, page]));
  const result: T[] = [];
  let emitted = false;
  const emitGroup = () => {
    if (emitted) return;
    emitted = true;
    for (const id of nextIds) {
      const page = byId.get(id);
      if (page) result.push(page);
    }
  };
  for (const page of remaining) {
    if (inGroup(page)) {
      emitGroup();
      continue;
    }
    result.push(page);
  }
  emitGroup();
  return result;
}

export function applyPageTypeChange<
  T extends { id: string; parentId: string | null; pageType: string },
>(pages: T[], pageId: string, pageType: string): T[] {
  const enteringList = pageType === "chapter" || pageType === "script";
  return pages.map((page) => {
    if (page.id === pageId) {
      const leavingOrEnteringList =
        enteringList ||
        page.pageType === "chapter" ||
        page.pageType === "script";
      return {
        ...page,
        pageType,
        parentId: leavingOrEnteringList ? null : page.parentId,
      };
    }
    if (enteringList && page.parentId === pageId) {
      if (pageType === "chapter" && page.pageType === "event") return page;
      if (pageType === "script" && page.pageType === "script_event") return page;
      return { ...page, parentId: null };
    }
    return page;
  });
}
