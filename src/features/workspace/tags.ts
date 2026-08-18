export const DEFAULT_TAG_COLOR = "#5a9a62";

export const TAG_COLOR_PALETTE = [
  { name: "Leaf", value: DEFAULT_TAG_COLOR },
  { name: "Pine", value: "#3f7655" },
  { name: "Teal", value: "#2f8f83" },
  { name: "Sky", value: "#3d8cbe" },
  { name: "Blue", value: "#4a7f9e" },
  { name: "Indigo", value: "#6270ad" },
  { name: "Purple", value: "#7a5a9a" },
  { name: "Plum", value: "#955f83" },
  { name: "Rose", value: "#b44f7a" },
  { name: "Red", value: "#c45c5c" },
  { name: "Coral", value: "#c96f58" },
  { name: "Orange", value: "#d48a3a" },
  { name: "Gold", value: "#a28a25" },
  { name: "Olive", value: "#71833b" },
  { name: "Brown", value: "#8c6b3f" },
  { name: "Slate", value: "#687782" },
] as const;

export function normalizeTagName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

export function isAllowedTagColor(value: string) {
  const normalized = value.toLowerCase();
  return TAG_COLOR_PALETTE.some((color) => color.value === normalized);
}

export function normalizeTagColor(value: unknown) {
  return typeof value === "string" && isAllowedTagColor(value)
    ? value.toLowerCase()
    : DEFAULT_TAG_COLOR;
}

export function filterTags<T extends { name: string }>(
  tags: T[],
  query: string,
) {
  const normalized = normalizeTagName(query).toLocaleLowerCase();
  if (!normalized) {
    return [...tags].sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );
  }
  return tags
    .filter((tag) => tag.name.toLocaleLowerCase().includes(normalized))
    .sort((left, right) => {
      const leftStarts = left.name.toLocaleLowerCase().startsWith(normalized);
      const rightStarts = right.name.toLocaleLowerCase().startsWith(normalized);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
      });
    });
}
