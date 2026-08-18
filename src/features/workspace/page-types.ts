export const PAGE_TYPES = [
  "page",
  "chapter",
  "event",
  "script",
  "character",
  "location",
  "animal",
  "transport",
  "unique_object",
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export const STORY_PAGE_TYPES = PAGE_TYPES.filter(
  (type): type is Exclude<PageType, "chapter"> => type !== "chapter",
);

export type PageFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
};

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  page: "Page",
  chapter: "Chapter",
  event: "Event",
  script: "Script",
  character: "Character",
  location: "Location",
  animal: "Animal",
  transport: "Transport",
  unique_object: "Unique object",
};

const AKA_FIELD: PageFieldDef = {
  key: "aka",
  label: "Also known as",
  placeholder: "Comma-separated names",
};

export const PAGE_TYPE_FIELDS: Record<PageType, PageFieldDef[]> = {
  page: [],
  chapter: [],
  event: [AKA_FIELD],
  script: [],
  character: [AKA_FIELD],
  location: [AKA_FIELD],
  animal: [AKA_FIELD],
  transport: [AKA_FIELD],
  unique_object: [AKA_FIELD],
};

export const PAGE_TYPE_COLORS: Record<PageType, string> = {
  page: "#6d746c",
  chapter: "#4d765b",
  event: "#8a6b3d",
  script: "#3f4d52",
  character: "#6a5a8a",
  location: "#3f6f86",
  animal: "#7a6240",
  transport: "#5a6d8a",
  unique_object: "#8a5a4d",
};

export function isPageType(value: string | null | undefined): value is PageType {
  return PAGE_TYPES.includes(value as PageType);
}

export function normalizePageType(value: unknown): PageType {
  return typeof value === "string" && isPageType(value) ? value : "page";
}

export function normalizePageFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const removedFields = new Set([
    "role",
    "wants",
    "region",
    "species",
    "kind",
    "owner",
  ]);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !removedFields.has(key))
      .map(([key, field]) => [
        key,
        typeof field === "string" ? field : String(field ?? ""),
      ]),
  );
}

export function parseAkaNames(value: string | undefined): string[] {
  if (!value) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(",")) {
    const name = part.trim();
    const key = name.toLocaleLowerCase();
    if (name.length < 2 || key === "untitled" || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function pageTypeHasAka(pageType: PageType) {
  return PAGE_TYPE_FIELDS[pageType].some((field) => field.key === "aka");
}

export type StoryRelationship = {
  id: string;
  fromPageId: string;
  toPageId: string;
  label: string;
  kind?: FamilyRelationshipKind | null;
};

export const FAMILY_RELATIONSHIP_KINDS = [
  "parent_of",
  "adoptive_parent_of",
  "partner",
  "former_partner",
] as const;

export type FamilyRelationshipKind =
  (typeof FAMILY_RELATIONSHIP_KINDS)[number];

export const FAMILY_RELATIONSHIP_LABELS: Record<
  FamilyRelationshipKind,
  string
> = {
  parent_of: "parent of",
  adoptive_parent_of: "adoptive parent of",
  partner: "partner",
  former_partner: "former partner",
};

export function normalizeFamilyRelationshipKind(
  value: unknown,
): FamilyRelationshipKind | null {
  return typeof value === "string" &&
    FAMILY_RELATIONSHIP_KINDS.includes(value as FamilyRelationshipKind)
    ? (value as FamilyRelationshipKind)
    : null;
}

export const RELATIONSHIP_SUGGESTIONS = [
  "lives in",
  "knows",
  "owns",
  "located in",
  "related to",
];
