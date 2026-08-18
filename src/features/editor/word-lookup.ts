export type WordRange = {
  from: number;
  to: number;
  word: string;
};

export type WordLookup = {
  corrections: string[];
  synonyms: string[];
  related: string[];
};

const WORD_CHAR = /[\p{L}\p{N}']/u;

export function wordRangeAt(text: string, offset: number): {
  start: number;
  end: number;
  word: string;
} | null {
  if (!text) return null;
  let index = Math.min(Math.max(offset, 0), text.length);
  if (index === text.length || !WORD_CHAR.test(text[index] ?? "")) {
    index -= 1;
  }
  while (index >= 0 && !WORD_CHAR.test(text[index] ?? "")) {
    index -= 1;
  }
  if (index < 0) return null;
  let start = index;
  let end = index + 1;
  while (start > 0 && WORD_CHAR.test(text[start - 1]!)) start -= 1;
  while (end < text.length && WORD_CHAR.test(text[end]!)) end += 1;
  const word = text.slice(start, end).replace(/^'+|'+$/g, "");
  if (word.length < 2) return null;
  return { start, end, word };
}

export function matchCasing(source: string, replacement: string) {
  if (!source) return replacement;
  if (source === source.toLocaleUpperCase() && source.length > 1) {
    return replacement.toLocaleUpperCase();
  }
  if (source[0] === source[0].toLocaleUpperCase()) {
    return replacement.charAt(0).toLocaleUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function uniqueWords(words: string[], skip: string) {
  const seen = new Set<string>();
  const skipKey = skip.toLocaleLowerCase();
  const result: string[] = [];
  for (const word of words) {
    const key = word.toLocaleLowerCase();
    if (!word || key === skipKey || seen.has(key)) continue;
    seen.add(key);
    result.push(word);
  }
  return result;
}

type DatamuseWord = { word?: string; tags?: string[] };

function usableWord(word: string) {
  const parts = word.split(/\s+/).filter(Boolean);
  return parts.length > 0 && parts.length <= 2 && word.length <= 24;
}

export function pickThesaurusWords(
  synonymHits: string[],
  relatedHits: string[],
  skip: string,
) {
  const synonyms = uniqueWords(synonymHits, skip).filter(usableWord).slice(0, 8);
  const related = uniqueWords(relatedHits, skip)
    .filter(
      (word) =>
        !synonyms.some((item) => item.toLocaleLowerCase() === word.toLocaleLowerCase()),
    )
    .filter(usableWord)
    .slice(0, 6);
  return { synonyms, related };
}

async function datamuse(params: string): Promise<DatamuseWord[]> {
  const response = await fetch(`https://api.datamuse.com/words?${params}`);
  if (!response.ok) return [];
  return (await response.json()) as DatamuseWord[];
}

function wordsFrom(rows: DatamuseWord[]) {
  return rows.map((row) => row.word?.trim() ?? "").filter(Boolean);
}

async function thesaurusFor(term: string, skip: string) {
  const query = encodeURIComponent(term.toLocaleLowerCase());
  const [synonyms, meansLike, specific, general] = await Promise.all([
    datamuse(`rel_syn=${query}&max=12`),
    datamuse(`ml=${query}&max=16`),
    datamuse(`rel_spc=${query}&max=8`),
    datamuse(`rel_gen=${query}&max=8`),
  ]);
  const synTagged = wordsFrom(
    meansLike.filter((row) => row.tags?.includes("syn")),
  );
  return pickThesaurusWords(
    [...synTagged, ...wordsFrom(synonyms)],
    [...wordsFrom(specific), ...wordsFrom(general)],
    skip,
  );
}

export async function lookupWord(word: string): Promise<WordLookup> {
  const query = encodeURIComponent(word.toLocaleLowerCase());
  const [spelled, thesaurus] = await Promise.all([
    datamuse(`sp=${query}&max=8`),
    thesaurusFor(word, word),
  ]);
  const spelledWords = wordsFrom(spelled);
  const known = spelledWords.some(
    (item) => item.toLocaleLowerCase() === word.toLocaleLowerCase(),
  );
  const corrections = known ? [] : uniqueWords(spelledWords, word).slice(0, 5);
  if (thesaurus.synonyms.length > 0 || thesaurus.related.length > 0) {
    return { corrections, ...thesaurus };
  }
  const fallback = corrections[0];
  if (!fallback) return { corrections, synonyms: [], related: [] };
  const fromCorrection = await thesaurusFor(fallback, word);
  return { corrections, ...fromCorrection };
}
