"use client";

import { Printer, X } from "lucide-react";

type ManuscriptPreviewProps = {
  projectTitle: string;
  chapters: { id: string; title: string; content: string }[];
  onClose: () => void;
};

export function ManuscriptPreview({
  projectTitle,
  chapters,
  onClose,
}: ManuscriptPreviewProps) {
  return (
    <div className="manuscript-preview">
      <div className="manuscript-toolbar">
        <button type="button" onClick={() => window.print()}>
          <Printer size={15} />
          Print / Save as PDF
        </button>
        <button type="button" className="secondary-button" onClick={onClose}>
          <X size={15} />
          Back to writing
        </button>
      </div>
      <article className="manuscript">
        <h1>{projectTitle}</h1>
        {chapters.length === 0 ? (
          <p>No chapters yet. Set a page type to Chapter to include it here.</p>
        ) : (
          chapters.map((chapter, index) => (
            <section key={chapter.id} className="manuscript-chapter">
              <h2>
                {index + 1}. {chapter.title || "Untitled"}
              </h2>
              <div
                className="manuscript-body"
                dangerouslySetInnerHTML={{ __html: chapter.content }}
              />
            </section>
          ))
        )}
      </article>
    </div>
  );
}
