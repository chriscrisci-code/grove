/** Unwrap anchors so print/PDF keeps link text without link chrome. */
export function stripHtmlLinks(html: string) {
  return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1");
}

export type ManuscriptMargin = "narrow" | "normal" | "wide";

export const MANUSCRIPT_MARGIN_STORAGE_KEY = "grove-manuscript-margin";
export const MANUSCRIPT_MARGIN_CSS_VAR = "--manuscript-margin";

export const MANUSCRIPT_MARGINS: Record<
  ManuscriptMargin,
  { label: string; inches: string }
> = {
  narrow: { label: "Narrow", inches: "0.5in" },
  normal: { label: "Normal", inches: "1in" },
  wide: { label: "Wide", inches: "1.5in" },
};

export function normalizeManuscriptMargin(value: unknown): ManuscriptMargin {
  if (value === "narrow" || value === "normal" || value === "wide") return value;
  return "normal";
}

export function readStoredManuscriptMargin(): ManuscriptMargin {
  if (typeof localStorage === "undefined") return "normal";
  return normalizeManuscriptMargin(
    localStorage.getItem(MANUSCRIPT_MARGIN_STORAGE_KEY),
  );
}

/** Put margin on :root so @page can use it when printing each sheet. */
export function applyManuscriptMarginToDocument(margin: ManuscriptMargin) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    MANUSCRIPT_MARGIN_CSS_VAR,
    MANUSCRIPT_MARGINS[margin].inches,
  );
}

export function clearManuscriptMarginFromDocument() {
  if (typeof document === "undefined") return;
  document.documentElement.style.removeProperty(MANUSCRIPT_MARGIN_CSS_VAR);
}
