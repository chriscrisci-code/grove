export const DICTATION_PAUSE_MS = 30_000;

export function shouldKeepDictationAlive(
  wantListening: boolean,
  lastSpeechAt: number,
  now: number,
  pauseMs = DICTATION_PAUSE_MS,
) {
  return wantListening && now - lastSpeechAt < pauseMs;
}

function wordsOf(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function wordKey(word: string) {
  return word.toLocaleLowerCase();
}

function sameWords(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((word, index) => wordKey(word) === wordKey(right[index]!))
  );
}

function startsWithWords(haystack: string[], needle: string[]) {
  if (needle.length > haystack.length) return false;
  return needle.every(
    (word, index) => wordKey(haystack[index]!) === wordKey(word),
  );
}

export function collapseRepeatedLead(text: string) {
  const words = wordsOf(text);
  if (words.length < 4) return words.join(" ");
  const first = wordKey(words[0]!);
  const second = wordKey(words[1]!);
  let count = 0;
  let index = 0;
  while (
    index + 1 < words.length &&
    wordKey(words[index]!) === first &&
    wordKey(words[index + 1]!) === second
  ) {
    count += 1;
    index += 2;
  }
  if (count < 2) return words.join(" ");
  return words.slice((count - 1) * 2).join(" ");
}

export function collapseGrowingRestatement(text: string) {
  const words = wordsOf(text);
  if (words.length < 3) return words.join(" ");

  const committed = [words[0]!];
  let index = 1;
  while (index < words.length) {
    const remaining = words.slice(index);
    if (startsWithWords(remaining, committed)) {
      const nextLength = committed.length + 1;
      if (remaining.length >= nextLength) {
        committed.splice(0, committed.length, ...remaining.slice(0, nextLength));
        index += nextLength;
        continue;
      }
      break;
    }
    committed.push(words[index]!);
    index += 1;
  }
  return committed.join(" ");
}

function normalizeIncoming(text: string) {
  return collapseGrowingRestatement(collapseRepeatedLead(text)).trim();
}

export function mergeDictationTranscript(
  committed: string,
  incoming: string,
) {
  const next = normalizeIncoming(incoming);
  const previous = normalizeIncoming(committed);
  if (!next) return previous;
  if (!previous) return next;

  const previousLower = previous.toLocaleLowerCase();
  const nextLower = next.toLocaleLowerCase();
  if (nextLower === previousLower) return previous;
  if (nextLower.startsWith(`${previousLower} `)) return next;
  if (previousLower.startsWith(`${nextLower} `)) return previous;

  const previousWords = wordsOf(previous);
  const nextWords = wordsOf(next);
  const maxOverlap = Math.min(previousWords.length, nextWords.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (
      sameWords(previousWords.slice(-overlap), nextWords.slice(0, overlap))
    ) {
      return [...previousWords, ...nextWords.slice(overlap)].join(" ");
    }
  }

  if (
    nextWords.length > previousWords.length &&
    startsWithWords(nextWords, previousWords.slice(0, 1))
  ) {
    return next;
  }

  return `${previous} ${next}`;
}

export function speechInsertDelta(committed: string, incoming: string) {
  const merged = mergeDictationTranscript(committed, incoming);
  const previous = normalizeIncoming(committed);
  if (!merged) return "";
  if (!previous) return merged;
  if (merged.toLocaleLowerCase() === previous.toLocaleLowerCase()) return "";

  const previousWords = wordsOf(previous);
  const mergedWords = wordsOf(merged);
  if (
    mergedWords.length >= previousWords.length &&
    sameWords(mergedWords.slice(0, previousWords.length), previousWords)
  ) {
    return mergedWords.slice(previousWords.length).join(" ");
  }
  return merged;
}
