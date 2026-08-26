export const SCRIPT_ELEMENTS = [
  "scene",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
] as const;

export type ScriptElement = (typeof SCRIPT_ELEMENTS)[number];

export const SCRIPT_ELEMENT_LABELS: Record<ScriptElement, string> = {
  scene: "Scene",
  action: "Action",
  character: "Char",
  parenthetical: "Paren",
  dialogue: "Talk",
  transition: "Cut",
};

export const SCRIPT_ELEMENT_TITLES: Record<ScriptElement, string> = {
  scene: "Scene heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
};

export const SLUGLINE_PREFIXES = ["INT.", "EXT.", "INT./EXT."] as const;

export const SLUGLINE_TIMES = [
  "DAY",
  "NIGHT",
  "DAWN",
  "DUSK",
  "MORNING",
  "EVENING",
  "LATER",
  "CONTINUOUS",
  "SAME",
] as const;

export type ScriptLine = {
  element: ScriptElement;
  text: string;
};

export type ScriptSlashResult = {
  element: ScriptElement;
  text: string;
  caret: number;
  openCharacterPicker: boolean;
};

const SLASH_COMMANDS = [
  "dissolve",
  "paren",
  "night",
  "dawn",
  "dusk",
  "later",
  "morning",
  "evening",
  "cont",
  "same",
  "fade",
  "cut",
  "ext",
  "int",
  "ie",
  "day",
  "c",
] as const;

const SAID_VERBS =
  "said|asked|replied|whispered|shouted|called|muttered|answered|cried|yelled";
const SPEAKER_PRONOUNS = new Set([
  "he",
  "she",
  "they",
  "it",
  "i",
  "we",
  "someone",
  "everybody",
  "him",
  "her",
  "them",
]);

export function isScriptElement(
  value: string | null | undefined,
): value is ScriptElement {
  return SCRIPT_ELEMENTS.includes(value as ScriptElement);
}

export function normalizeScriptElement(value: unknown): ScriptElement {
  return typeof value === "string" && isScriptElement(value) ? value : "action";
}

export function nextElementOnEnter(current: ScriptElement): ScriptElement {
  switch (current) {
    case "scene":
      return "action";
    case "action":
      return "action";
    case "character":
      return "dialogue";
    case "parenthetical":
      return "dialogue";
    case "dialogue":
      return "action";
    case "transition":
      return "scene";
  }
}

export function nextElementOnTab(current: ScriptElement): ScriptElement {
  switch (current) {
    case "scene":
      return "scene";
    case "action":
      return "character";
    case "character":
      return "parenthetical";
    case "parenthetical":
      return "dialogue";
    case "dialogue":
      return "character";
    case "transition":
      return "scene";
  }
}

export function cycleSluglinePrefix(text: string): { text: string; caret: number } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { text: "INT.  - DAY", caret: 5 };
  }
  const match = trimmed.match(/^(INT\.\/EXT\.|INT\.|EXT\.|EST\.)\s*/i);
  const rest = match ? trimmed.slice(match[0].length) : trimmed;
  const current = match?.[1]?.toUpperCase() ?? "";
  let next: (typeof SLUGLINE_PREFIXES)[number] = "INT.";
  if (current === "INT.") next = "EXT.";
  else if (current === "EXT." || current === "EST.") next = "INT./EXT.";
  else if (current === "INT./EXT.") next = "INT.";
  const body = rest || "- DAY";
  const nextText = `${next} ${body}`.replace(/\s+/g, " ").trim();
  return { text: nextText, caret: next.length + 1 };
}

export function applySluglineTime(text: string, time: string): string {
  const stamp = time.trim().toUpperCase();
  const trimmed = text.trim();
  if (!trimmed) return `INT.  - ${stamp}`;
  if (/\s[-–—]\s+[A-Z][A-Z0-9 /]*$/u.test(trimmed)) {
    return trimmed.replace(/\s[-–—]\s+[A-Z][A-Z0-9 /]*$/u, ` - ${stamp}`);
  }
  return `${trimmed} - ${stamp}`;
}

export function matchScriptSlashCommand(beforeCaret: string) {
  const match = beforeCaret.match(/\/([a-z.]+)$/i);
  if (!match || match.index === undefined) return null;
  const name = match[1].toLowerCase();
  if (!(SLASH_COMMANDS as readonly string[]).includes(name)) return null;
  return { command: name, from: match.index, token: match[0] };
}

export function applyScriptSlash(
  beforeCaret: string,
  currentElement: ScriptElement,
): ScriptSlashResult | null {
  const match = matchScriptSlashCommand(beforeCaret);
  if (!match) return null;
  const prefix = beforeCaret.slice(0, match.from).trimEnd();
  switch (match.command) {
    case "int":
      return sluglineResult("INT.", prefix);
    case "ext":
      return sluglineResult("EXT.", prefix);
    case "ie":
      return sluglineResult("INT./EXT.", prefix);
    case "c":
      return {
        element: "character",
        text: "",
        caret: 0,
        openCharacterPicker: true,
      };
    case "paren":
      return {
        element: "parenthetical",
        text: "()",
        caret: 1,
        openCharacterPicker: false,
      };
    case "cut":
      return {
        element: "transition",
        text: "CUT TO:",
        caret: 7,
        openCharacterPicker: false,
      };
    case "fade":
      return {
        element: "transition",
        text: "FADE OUT.",
        caret: 9,
        openCharacterPicker: false,
      };
    case "dissolve":
      return {
        element: "transition",
        text: "DISSOLVE TO:",
        caret: 12,
        openCharacterPicker: false,
      };
    case "day":
    case "night":
    case "dawn":
    case "dusk":
    case "later":
    case "morning":
    case "evening":
    case "same":
    case "cont": {
      const time = match.command === "cont" ? "CONTINUOUS" : match.command.toUpperCase();
      const source =
        currentElement === "scene" && prefix ? prefix : prefix || "INT. ";
      const text = applySluglineTime(source, time);
      return {
        element: "scene",
        text,
        caret: text.length,
        openCharacterPicker: false,
      };
    }
    default:
      return null;
  }
}

function sluglineResult(prefix: string, location: string): ScriptSlashResult {
  const place = location || "";
  const text = `${prefix} ${place} - DAY`.replace(/\s+/g, " ").trim();
  const caret = prefix.length + 1;
  return { element: "scene", text, caret, openCharacterPicker: false };
}

export function filterCharacterSuggestions(
  query: string,
  catalog: string[],
  recent: string[] = [],
) {
  const needle = query.trim().toLocaleLowerCase();
  const seen = new Set<string>();
  const ordered: string[] = [];

  function pushUnique(name: string) {
    const label = name.trim();
    const key = label.toLocaleLowerCase();
    if (!label || key === "untitled" || seen.has(key)) return false;
    seen.add(key);
    ordered.push(label);
    return true;
  }

  if (!needle) {
    for (const name of recent) pushUnique(name);
    for (const name of catalog) pushUnique(name);
    return ordered.slice(0, 12);
  }

  const prefix: string[] = [];
  const contains: string[] = [];
  function consider(name: string) {
    const label = name.trim();
    const key = label.toLocaleLowerCase();
    if (!label || key === "untitled" || seen.has(key)) return;
    if (key.startsWith(needle)) {
      seen.add(key);
      prefix.push(label);
    } else if (key.includes(needle)) {
      seen.add(key);
      contains.push(label);
    }
  }

  for (const name of recent) consider(name);
  for (const name of catalog) consider(name);
  return [...prefix, ...contains].slice(0, 12);
}

export function collectCharacterNamesFromHtml(html: string) {
  const names: string[] = [];
  const seen = new Set<string>();
  const pattern =
    /<p[^>]*data-script=["']character["'][^>]*>([\s\S]*?)<\/p>/gi;
  for (const match of html.matchAll(pattern)) {
    const name = decodeHtml(stripTags(match[1] ?? "")).trim();
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function htmlToPlainParagraphs(html: string) {
  const withBreaks = html
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtml(withBreaks)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function proseParagraphsToScriptLines(paragraphs: string[]): ScriptLine[] {
  const lines: ScriptLine[] = [];
  let lastCharacter = "";
  for (const paragraph of paragraphs) {
    const converted = paragraphToScriptLines(paragraph, lastCharacter);
    for (const line of converted) {
      lines.push(line);
      if (line.element === "character") lastCharacter = line.text;
    }
  }
  return lines.length > 0
    ? lines
    : [{ element: "action", text: "" }];
}

export function scriptLinesToHtml(lines: ScriptLine[]) {
  if (lines.length === 0) return '<p data-script="action"></p>';
  return lines
    .map(
      (line) =>
        `<p data-script="${line.element}">${escapeHtml(line.text)}</p>`,
    )
    .join("");
}

export function proseToScriptHtml(html: string) {
  return scriptLinesToHtml(proseParagraphsToScriptLines(htmlToPlainParagraphs(html)));
}

export function isScriptHtmlEmpty(html: string | undefined) {
  if (!html) return true;
  const text = decodeHtml(stripTags(html)).replace(/\u00a0/g, " ").trim();
  return text.length === 0;
}

export function htmlToScriptHtml(html: string) {
  if (isScriptHtmlEmpty(html)) return '<p data-script="action"></p>';
  if (/data-script\s*=/i.test(html)) return html;
  return html.replace(/<p\b/gi, '<p data-script="action"');
}

export function mergeScriptHtml(existing: string, incoming: string) {
  if (isScriptHtmlEmpty(existing)) return incoming;
  if (isScriptHtmlEmpty(incoming)) return existing;
  return `${existing}${incoming}`;
}

function paragraphToScriptLines(
  paragraph: string,
  lastCharacter: string,
): ScriptLine[] {
  if (/^(INT\.\/EXT\.|INT\.|EXT\.|EST\.)/i.test(paragraph)) {
    return [{ element: "scene", text: paragraph.toUpperCase() }];
  }
  if (/^[A-Z0-9 .'-]+:$/.test(paragraph) || /TO:\s*$/.test(paragraph.toUpperCase())) {
    if (paragraph === paragraph.toUpperCase() && paragraph.length <= 24) {
      return [{ element: "transition", text: paragraph.toUpperCase() }];
    }
  }
  if (
    paragraph === paragraph.toUpperCase() &&
    paragraph.length <= 40 &&
    /^[A-Z0-9 .'\-()]+$/.test(paragraph) &&
    !/[.!?]$/.test(paragraph)
  ) {
    return [{ element: "character", text: paragraph }];
  }
  if (/^\([^)]+\)$/.test(paragraph)) {
    return [{ element: "parenthetical", text: paragraph }];
  }

  const speakerThenQuote = paragraph.match(
    new RegExp(
      `^([\\p{L}][\\p{L}'\\-]*(?:\\s+[\\p{L}][\\p{L}'\\-]*){0,2})\\s+(?:${SAID_VERBS})[,\\s]+[“"'](.+)[”"']\\s*$`,
      "iu",
    ),
  );
  if (speakerThenQuote) {
    return characterDialogue(speakerThenQuote[1], speakerThenQuote[2], lastCharacter);
  }

  const quoteThenSpeaker = paragraph.match(
    new RegExp(
      `^[“"'](.+)[”"'][,\\s]+(?:${SAID_VERBS})\\s+([\\p{L}][\\p{L}'\\-]*(?:\\s+[\\p{L}][\\p{L}'\\-]*){0,2})\\.?\\s*$`,
      "iu",
    ),
  );
  if (quoteThenSpeaker) {
    return characterDialogue(quoteThenSpeaker[2], quoteThenSpeaker[1], lastCharacter);
  }

  const quoteThenNameVerb = paragraph.match(
    new RegExp(
      `^[“"'](.+)[”"'][,\\s]+([\\p{L}][\\p{L}'\\-]*(?:\\s+[\\p{L}][\\p{L}'\\-]*){0,2})\\s+(?:${SAID_VERBS})\\.?\\s*$`,
      "iu",
    ),
  );
  if (quoteThenNameVerb) {
    return characterDialogue(quoteThenNameVerb[2], quoteThenNameVerb[1], lastCharacter);
  }

  const onlyQuote = paragraph.match(/^[“"'](.+)[”"']\s*$/u);
  if (onlyQuote) {
    return lastCharacter
      ? [
          { element: "character", text: lastCharacter },
          { element: "dialogue", text: cleanQuote(onlyQuote[1]) },
        ]
      : [{ element: "dialogue", text: cleanQuote(onlyQuote[1]) }];
  }

  return [{ element: "action", text: paragraph }];
}

function characterDialogue(
  speaker: string | undefined,
  quote: string | undefined,
  lastCharacter: string,
): ScriptLine[] {
  const name = speaker?.trim() ?? "";
  const dialogue = cleanQuote(quote);
  if (!name || SPEAKER_PRONOUNS.has(name.toLocaleLowerCase())) {
    return lastCharacter
      ? [
          { element: "character", text: lastCharacter },
          { element: "dialogue", text: dialogue },
        ]
      : [{ element: "dialogue", text: dialogue }];
  }
  return [
    { element: "character", text: name.toUpperCase() },
    { element: "dialogue", text: dialogue },
  ];
}

function cleanQuote(value: string | undefined) {
  return (value ?? "").replace(/[“”"']/g, "").replace(/,\s*$/, "").trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
