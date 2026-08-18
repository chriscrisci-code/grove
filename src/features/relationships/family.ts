import type {
  FamilyRelationshipKind,
  PageType,
  StoryRelationship,
} from "@/features/workspace/page-types";

export type FamilyPage = {
  id: string;
  title: string;
  pageType: PageType;
};

export type FamilyNode = FamilyPage & {
  x: number;
  y: number;
  generation: number;
};

export type FamilyEdge = StoryRelationship & {
  kind: FamilyRelationshipKind;
};

export function familyRelationships(
  relationships: StoryRelationship[],
): FamilyEdge[] {
  return relationships.filter(
    (relationship): relationship is FamilyEdge =>
      relationship.kind === "parent_of" ||
      relationship.kind === "adoptive_parent_of" ||
      relationship.kind === "partner" ||
      relationship.kind === "former_partner",
  );
}

export function canonicalFamilyPair(
  fromPageId: string,
  toPageId: string,
  kind: FamilyRelationshipKind,
) {
  if (
    (kind === "partner" || kind === "former_partner") &&
    fromPageId.localeCompare(toPageId) > 0
  ) {
    return { fromPageId: toPageId, toPageId: fromPageId };
  }
  return { fromPageId, toPageId };
}

export function validateFamilyRelationship({
  pages,
  relationships,
  fromPageId,
  toPageId,
  kind,
}: {
  pages: FamilyPage[];
  relationships: StoryRelationship[];
  fromPageId: string;
  toPageId: string;
  kind: FamilyRelationshipKind;
}) {
  if (fromPageId === toPageId) return "Choose two different characters.";
  const byId = new Map(pages.map((page) => [page.id, page]));
  if (
    byId.get(fromPageId)?.pageType !== "character" ||
    byId.get(toPageId)?.pageType !== "character"
  ) {
    return "Family relationships can only connect Character pages.";
  }
  const pair = canonicalFamilyPair(fromPageId, toPageId, kind);
  if (
    relationships.some(
      (relationship) =>
        relationship.kind === kind &&
        relationship.fromPageId === pair.fromPageId &&
        relationship.toPageId === pair.toPageId,
    )
  ) {
    return "That family relationship already exists.";
  }
  if (kind !== "parent_of" && kind !== "adoptive_parent_of") return null;

  const children = new Map<string, string[]>();
  for (const relationship of familyRelationships(relationships)) {
    if (
      relationship.kind !== "parent_of" &&
      relationship.kind !== "adoptive_parent_of"
    ) {
      continue;
    }
    const next = children.get(relationship.fromPageId) ?? [];
    next.push(relationship.toPageId);
    children.set(relationship.fromPageId, next);
  }
  const seen = new Set<string>();
  const stack = [toPageId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === fromPageId) {
      return "That parent link would create a family cycle.";
    }
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(children.get(current) ?? []));
  }
  return null;
}

export function layoutFamilyTree(
  pages: FamilyPage[],
  relationships: StoryRelationship[],
) {
  const characters = pages.filter((page) => page.pageType === "character");
  const ids = new Set(characters.map((page) => page.id));
  const edges = familyRelationships(relationships).filter(
    (relationship) =>
      ids.has(relationship.fromPageId) && ids.has(relationship.toPageId),
  );
  const generations = new Map(characters.map((page) => [page.id, 0]));

  for (let pass = 0; pass < characters.length; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      if (edge.kind !== "parent_of" && edge.kind !== "adoptive_parent_of") {
        continue;
      }
      const next = Math.min(
        characters.length,
        (generations.get(edge.fromPageId) ?? 0) + 1,
      );
      if (next > (generations.get(edge.toPageId) ?? 0)) {
        generations.set(edge.toPageId, next);
        changed = true;
      }
    }
    for (const edge of edges) {
      if (edge.kind !== "partner" && edge.kind !== "former_partner") continue;
      const shared = Math.max(
        generations.get(edge.fromPageId) ?? 0,
        generations.get(edge.toPageId) ?? 0,
      );
      if (generations.get(edge.fromPageId) !== shared) {
        generations.set(edge.fromPageId, shared);
        changed = true;
      }
      if (generations.get(edge.toPageId) !== shared) {
        generations.set(edge.toPageId, shared);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const groups = new Map<number, FamilyPage[]>();
  for (const page of characters) {
    const generation = generations.get(page.id) ?? 0;
    const group = groups.get(generation) ?? [];
    group.push(page);
    groups.set(generation, group);
  }

  const nodes: FamilyNode[] = [];
  for (const [generation, group] of [...groups.entries()].sort(
    ([left], [right]) => left - right,
  )) {
    group.sort((left, right) =>
      left.title.localeCompare(right.title, undefined, { sensitivity: "base" }),
    );
    group.forEach((page, index) => {
      nodes.push({
        ...page,
        generation,
        x: 110 + index * 190,
        y: 70 + generation * 140,
      });
    });
  }

  return {
    nodes,
    edges,
    width: Math.max(
      720,
      ...[...groups.values()].map((group) => 220 + group.length * 190),
    ),
    height: Math.max(
      480,
      180 + (Math.max(0, ...generations.values()) + 1) * 140,
    ),
  };
}
