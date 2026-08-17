export type LinkablePage = {
  id: string;
  title: string;
};

export type TitleMatch = {
  from: number;
  to: number;
  pageId: string;
};

function isLetterOrNumber(char: string | undefined) {
  return Boolean(char && /[\p{L}\p{N}]/u.test(char));
}

function isWordBoundaryStart(text: string, index: number) {
  return index === 0 || !isLetterOrNumber(text[index - 1]);
}

function isWordBoundaryEnd(text: string, end: number) {
  return end >= text.length || !isLetterOrNumber(text[end]);
}

function rangeIsFree(used: boolean[], from: number, to: number) {
  for (let index = from; index < to; index += 1) {
    if (used[index]) return false;
  }
  return true;
}

export function catalogLinkablePages(pages: LinkablePage[]): LinkablePage[] {
  const seen = new Set<string>();
  const catalog: LinkablePage[] = [];
  for (const page of pages) {
    const title = page.title.trim();
    const key = title.toLocaleLowerCase();
    if (title.length < 2 || key === "untitled" || seen.has(key)) continue;
    seen.add(key);
    catalog.push({ id: page.id, title });
  }
  return catalog.sort((a, b) => b.title.length - a.title.length);
}

export function findPageTitleMatches(
  text: string,
  pages: LinkablePage[],
): TitleMatch[] {
  const catalog = catalogLinkablePages(pages);
  if (!text || catalog.length === 0) return [];

  const lower = text.toLocaleLowerCase();
  const used = Array.from({ length: text.length }, () => false);
  const matches: TitleMatch[] = [];

  for (const page of catalog) {
    const needle = page.title.toLocaleLowerCase();
    let searchFrom = 0;
    while (searchFrom <= lower.length - needle.length) {
      const index = lower.indexOf(needle, searchFrom);
      if (index === -1) break;
      const end = index + needle.length;
      if (
        isWordBoundaryStart(text, index) &&
        isWordBoundaryEnd(text, end) &&
        rangeIsFree(used, index, end)
      ) {
        for (let cursor = index; cursor < end; cursor += 1) used[cursor] = true;
        matches.push({ from: index, to: end, pageId: page.id });
      }
      searchFrom = index + 1;
    }
  }

  return matches.sort((a, b) => a.from - b.from);
}
