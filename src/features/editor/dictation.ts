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

export function collapseRepeatedLead(text: string) {
  const words = wordsOf(text);
  if (words.length < 4) return words.join(" ");
  const first = words[0]!.toLocaleLowerCase();
  const second = words[1]!.toLocaleLowerCase();
  let count = 0;
  let index = 0;
  while (
    index + 1 < words.length &&
    words[index]!.toLocaleLowerCase() === first &&
    words[index + 1]!.toLocaleLowerCase() === second
  ) {
    count += 1;
    index += 2;
  }
  if (count < 2) return words.join(" ");
  return words.slice((count - 1) * 2).join(" ");
}

export function speechInsertDelta(committed: string, incoming: string) {
  const next = collapseRepeatedLead(incoming);
  const previous = committed.trim();
  if (!next) return "";
  if (!previous) return next;

  const previousLower = previous.toLocaleLowerCase();
  const nextLower = next.toLocaleLowerCase();
  if (nextLower === previousLower) return "";
  if (nextLower.startsWith(`${previousLower} `)) {
    return next.slice(previous.length).trim();
  }
  if (
    previousLower.startsWith(`${nextLower} `) ||
    previousLower.startsWith(nextLower) ||
    previousLower.endsWith(` ${nextLower}`) ||
    previousLower.endsWith(nextLower)
  ) {
    return "";
  }

  const previousWords = wordsOf(previous);
  const nextWords = wordsOf(next);
  if (nextWords.length > previousWords.length) {
    const prefix = nextWords
      .slice(0, previousWords.length)
      .join(" ")
      .toLocaleLowerCase();
    if (prefix === previousLower) {
      return nextWords.slice(previousWords.length).join(" ");
    }
  }
  return next;
}
