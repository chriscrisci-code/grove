"use client";

import { Printer, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import {
  MANUSCRIPT_MARGINS,
  MANUSCRIPT_MARGIN_STORAGE_KEY,
  MANUSCRIPT_PAGE_NUMBERS_STORAGE_KEY,
  applyManuscriptMarginToDocument,
  clearManuscriptMarginFromDocument,
  clearManuscriptPrintPageStyle,
  normalizeManuscriptMargin,
  readStoredManuscriptMargin,
  readStoredManuscriptPageNumbers,
  stripHtmlLinks,
  syncManuscriptPrintPageStyle,
  type ManuscriptMargin,
} from "@/features/workspace/manuscript-print";

type ManuscriptPreviewProps = {
  projectTitle: string;
  chapters: { id: string; title: string; content: string }[];
  kind?: "manuscript" | "script";
  onClose: () => void;
};

export function ManuscriptPreview({
  projectTitle,
  chapters,
  kind = "manuscript",
  onClose,
}: ManuscriptPreviewProps) {
  const isScript = kind === "script";
  const [margin, setMargin] = useState<ManuscriptMargin>("normal");
  const [pageNumbers, setPageNumbers] = useState(false);

  useEffect(() => {
    const storedMargin = readStoredManuscriptMargin();
    const storedNumbers = readStoredManuscriptPageNumbers();
    setMargin(storedMargin);
    setPageNumbers(storedNumbers);
    applyManuscriptMarginToDocument(storedMargin);
    syncManuscriptPrintPageStyle(storedNumbers);
    return () => {
      clearManuscriptMarginFromDocument();
      clearManuscriptPrintPageStyle();
    };
  }, []);

  useEffect(() => {
    applyManuscriptMarginToDocument(margin);
  }, [margin]);

  useEffect(() => {
    syncManuscriptPrintPageStyle(pageNumbers);
  }, [pageNumbers]);

  function chooseMargin(next: ManuscriptMargin) {
    setMargin(next);
    localStorage.setItem(MANUSCRIPT_MARGIN_STORAGE_KEY, next);
  }

  function togglePageNumbers() {
    setPageNumbers((current) => {
      const next = !current;
      localStorage.setItem(
        MANUSCRIPT_PAGE_NUMBERS_STORAGE_KEY,
        next ? "on" : "off",
      );
      return next;
    });
  }

  function printManuscript() {
    const previousTitle = document.title;
    document.title = projectTitle.trim() || " ";
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  const marginValue = MANUSCRIPT_MARGINS[margin].inches;

  return (
    <div className="manuscript-preview">
      <div className="manuscript-toolbar">
        <div
          className="manuscript-margin-controls"
          role="group"
          aria-label="Page margins on all sides"
        >
          <span>Margins</span>
          {(Object.keys(MANUSCRIPT_MARGINS) as ManuscriptMargin[]).map(
            (value) => (
              <button
                type="button"
                key={value}
                className={
                  margin === value
                    ? "manuscript-margin-button active"
                    : "manuscript-margin-button"
                }
                aria-pressed={margin === value}
                onClick={() => chooseMargin(normalizeManuscriptMargin(value))}
              >
                {MANUSCRIPT_MARGINS[value].label}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          className={
            pageNumbers
              ? "manuscript-margin-button active"
              : "manuscript-margin-button"
          }
          aria-pressed={pageNumbers}
          title="Show page numbers centered at the bottom of each printed page"
          onClick={togglePageNumbers}
        >
          Page numbers
        </button>
        <button type="button" onClick={printManuscript}>
          <Printer size={15} />
          Print / Save as PDF
        </button>
        <button type="button" className="secondary-button" onClick={onClose}>
          <X size={15} />
          Back to writing
        </button>
      </div>
      <article
        className={`manuscript ${isScript ? "script-manuscript" : ""}`}
        style={
          {
            "--manuscript-margin": marginValue,
          } as CSSProperties
        }
      >
        <h1>{projectTitle}</h1>
        {chapters.length === 0 ? (
          <p>
            {isScript
              ? "No scripts yet. Set a page type to Script to include it here."
              : "No chapters yet. Set a page type to Chapter to include it here."}
          </p>
        ) : (
          chapters.map((chapter, index) => (
            <section key={chapter.id} className="manuscript-chapter">
              <h2>
                {index + 1}. {chapter.title || "Untitled"}
              </h2>
              <div
                className={`manuscript-body ${isScript ? "script-body" : ""}`}
                dangerouslySetInnerHTML={{
                  __html: stripHtmlLinks(chapter.content),
                }}
              />
            </section>
          ))
        )}
      </article>
    </div>
  );
}
