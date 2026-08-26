/** Unwrap anchors so print/PDF keeps link text without link chrome. */
export function stripHtmlLinks(html: string) {
  return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1");
}

export type ManuscriptMargin = "narrow" | "normal" | "wide";

export const MANUSCRIPT_MARGIN_STORAGE_KEY = "grove-manuscript-margin";
export const MANUSCRIPT_PAGE_NUMBERS_STORAGE_KEY =
  "grove-manuscript-page-numbers";
export const MANUSCRIPT_MARGIN_CSS_VAR = "--manuscript-margin";
export const MANUSCRIPT_PRINT_PAGE_STYLE_ID = "grove-manuscript-print-page";

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

export function readStoredManuscriptPageNumbers(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(MANUSCRIPT_PAGE_NUMBERS_STORAGE_KEY) === "on";
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

/**
 * Margin boxes replace Chromium/Safari default print chrome (date, title, URL).
 * Optional bottom-center page number when enabled.
 */
export function buildManuscriptPrintPageCss(pageNumbers: boolean) {
  const pageNumberContent = pageNumbers ? "counter(page)" : "none";
  return `
@media print {
  @page {
    margin: var(--manuscript-margin, 1in);
    @top-left { content: none; }
    @top-center { content: none; }
    @top-right { content: none; }
    @bottom-left { content: none; }
    @bottom-right { content: none; }
    @bottom-center {
      content: ${pageNumberContent};
      font-family: "Courier Prime", "Courier New", Courier, monospace;
      font-size: 10pt;
      color: #333;
    }
  }
}
`;
}

export function syncManuscriptPrintPageStyle(pageNumbers: boolean) {
  if (typeof document === "undefined") return;
  let style = document.getElementById(
    MANUSCRIPT_PRINT_PAGE_STYLE_ID,
  ) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = MANUSCRIPT_PRINT_PAGE_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = buildManuscriptPrintPageCss(pageNumbers);
}

export function clearManuscriptPrintPageStyle() {
  if (typeof document === "undefined") return;
  document.getElementById(MANUSCRIPT_PRINT_PAGE_STYLE_ID)?.remove();
}
