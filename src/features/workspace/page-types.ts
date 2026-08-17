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

export const PAGE_TYPE_FIELDS: Record<PageType, PageFieldDef[]> = {
  page: [],
  chapter: [],
  character: [
    { key: "role", label: "Role" },
    { key: "wants", label: "Wants" },
  ],
  location: [{ key: "region", label: "Region" }],
  animal: [{ key: "species", label: "Species" }],
  transport: [{ key: "kind", label: "Kind" }],
  unique_object: [{ key: "owner", label: "Owner" }],
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
