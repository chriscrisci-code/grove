export const PAGE_TYPES = [
  "page",
  "chapter",
  "character",
  "location",
  "animal",
  "transport",
  "unique_object",
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export type PageFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
};

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  page: "Page",
  chapter: "Chapter",
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
  character: [
    { key: "role", label: "Role" },
    { key: "wants", label: "Wants" },
    AKA_FIELD,
  ],
  location: [{ key: "region", label: "Region" }, AKA_FIELD],
  animal: [{ key: "species", label: "Species" }, AKA_FIELD],
  transport: [{ key: "kind", label: "Kind" }, AKA_FIELD],
  unique_object: [{ key: "owner", label: "Owner" }, AKA_FIELD],
};

export const PAGE_TYPE_COLORS: Record<PageType, string> = {
  page: "#6d746c",
  chapter: "#4d765b",
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
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, field]) => [
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
};

export const RELATIONSHIP_SUGGESTIONS = [
  "lives in",
  "knows",
  "owns",
  "located in",
  "related to",
];
