export type TreePage = {
  id: string;
  parentId: string | null;
};

export type PageDrop = {
  type: "before" | "after" | "inside";
  targetId: string;
};

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

export function dropPlacementFromOffset(offsetRatio: number): PageDrop["type"] {
  if (offsetRatio < 0.28) return "before";
  if (offsetRatio > 0.72) return "after";
  return "inside";
}

export function applyPageDrop<T extends TreePage>(
  pages: T[],
  draggedId: string,
  drop: PageDrop,
): T[] | null {
  const dragged = pages.find((page) => page.id === draggedId);
  const target = pages.find((page) => page.id === drop.targetId);
  if (!dragged || !target) return null;
  if (draggedId === drop.targetId) return null;
  if (isDescendantOf(pages, draggedId, drop.targetId)) return null;

  let newParentId: string | null;
  let beforeId: string | null;
  if (drop.type === "inside") {
    newParentId = target.id;
    beforeId = null;
  } else if (drop.type === "before") {
    newParentId = target.parentId;
    beforeId = target.id;
  } else {
    newParentId = target.parentId;
    const siblings = pages.filter(
      (page) => page.parentId === target.parentId && page.id !== draggedId,
    );
    const targetIndex = siblings.findIndex((page) => page.id === target.id);
    beforeId = siblings[targetIndex + 1]?.id ?? null;
  }

  if (newParentId === draggedId) return null;
  if (newParentId && isDescendantOf(pages, draggedId, newParentId)) return null;

  const moved = { ...dragged, parentId: newParentId };
  const remaining = pages.filter((page) => page.id !== draggedId);
  const siblingIds = remaining
    .filter((page) => page.parentId === newParentId)
    .map((page) => page.id);
  const nextSiblingIds = [...siblingIds];
  const insertIndex = beforeId ? nextSiblingIds.indexOf(beforeId) : -1;
  if (insertIndex >= 0) nextSiblingIds.splice(insertIndex, 0, draggedId);
  else nextSiblingIds.push(draggedId);

  const byId = new Map(remaining.map((page) => [page.id, page]));
  byId.set(draggedId, moved);

  const result: T[] = [];
  let siblingsEmitted = false;
  const emitSiblings = () => {
    if (siblingsEmitted) return;
    siblingsEmitted = true;
    for (const id of nextSiblingIds) {
      const page = byId.get(id);
      if (page) result.push(page);
    }
  };

  for (const page of remaining) {
    if (page.parentId === newParentId) {
      emitSiblings();
      continue;
    }
    result.push(page);
    if (page.id === newParentId) emitSiblings();
  }
  emitSiblings();
  return result;
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
  return pages.map((page) => {
    if (page.id === pageId) {
      const leavingOrEnteringChapter =
        pageType === "chapter" || page.pageType === "chapter";
      return {
        ...page,
        pageType,
        parentId: leavingOrEnteringChapter ? null : page.parentId,
      };
    }
    if (pageType === "chapter" && page.parentId === pageId) {
      return { ...page, parentId: null };
    }
    return page;
  });
}
