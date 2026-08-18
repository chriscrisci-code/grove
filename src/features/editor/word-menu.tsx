"use client";

import { useEffect, useRef } from "react";
import type { WordLookup } from "@/features/editor/word-lookup";

type WordMenuProps = {
  word: string;
  x: number;
  y: number;
  loading: boolean;
  lookup: WordLookup | null;
  onPick: (next: string) => void;
  onClose: () => void;
};

export function WordMenu({
  word,
  x,
  y,
  loading,
  lookup,
  onPick,
  onClose,
}: WordMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - 280);

  return (
    <div
      ref={menuRef}
      className="word-menu"
      role="menu"
      aria-label={`Suggestions for ${word}`}
      style={{ left, top }}
    >
      <p className="word-menu-term">{word}</p>
      {lookup?.corrections.length ? (
        <section>
          <h3>Spelling</h3>
          {lookup.corrections.map((item) => (
            <button
              type="button"
              role="menuitem"
              key={`sp-${item}`}
              onClick={() => onPick(item)}
            >
              {item}
            </button>
          ))}
        </section>
      ) : null}
      <section>
        <h3>Synonyms</h3>
        {loading && <p className="word-menu-empty">Looking up…</p>}
        {!loading &&
          lookup &&
          lookup.synonyms.length === 0 &&
          lookup.related.length === 0 && (
            <p className="word-menu-empty">No synonyms found.</p>
          )}
        {lookup?.synonyms.map((item) => (
          <button
            type="button"
            role="menuitem"
            key={`syn-${item}`}
            onClick={() => onPick(item)}
          >
            {item}
          </button>
        ))}
      </section>
      {lookup?.related.length ? (
        <section>
          <h3>Related</h3>
          {lookup.related.map((item) => (
            <button
              type="button"
              role="menuitem"
              key={`rel-${item}`}
              onClick={() => onPick(item)}
            >
              {item}
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
