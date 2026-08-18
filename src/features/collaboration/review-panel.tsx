"use client";

import {
  CheckCircle2,
  ClipboardCopy,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  Quote,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PageComment = {
  id: string;
  author_id: string;
  author_email: string;
  kind: "comment" | "suggestion";
  body: string;
  quoted_text: string | null;
  suggestion_text: string | null;
  resolved_at: string | null;
  created_at: string;
};

export function ReviewPanel({
  pageId,
  pageTitle,
  userId,
  selectedText,
  canResolve,
  canModerate,
  canApplySuggestions,
  onApplySuggestion,
  onClose,
}: {
  pageId: string;
  pageTitle: string;
  userId?: string;
  selectedText: string;
  canResolve: boolean;
  canModerate: boolean;
  canApplySuggestions?: boolean;
  onApplySuggestion?: (
    quotedText: string | null,
    suggestionText: string,
  ) => boolean;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<PageComment[]>([]);
  const [kind, setKind] = useState<"comment" | "suggestion">("comment");
  const [quote, setQuote] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await createClient().rpc("list_page_comments", {
      p_page_id: pageId,
    });
    setLoading(false);
    if (error) {
      setMessage("Comments could not be loaded.");
      return;
    }
    setComments((data ?? []) as PageComment[]);
  }, [pageId]);

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .rpc("list_page_comments", { p_page_id: pageId })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          setMessage("Comments could not be loaded.");
          return;
        }
        setComments((data ?? []) as PageComment[]);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  async function createComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") ?? "");
    const suggestion = String(form.get("suggestion") ?? "");
    setWorking("create");
    setMessage("");
    const { error } = await createClient().rpc("create_page_comment", {
      p_page_id: pageId,
      p_kind: kind,
      p_body: body,
      p_quoted_text: quote || null,
      p_suggestion_text: kind === "suggestion" ? suggestion : null,
    });
    setWorking("");
    if (error) {
      setMessage(error.message);
      return;
    }
    event.currentTarget.reset();
    setQuote("");
    setKind("comment");
    await load();
  }

  async function setResolved(commentId: string, resolved: boolean) {
    setWorking(commentId);
    const { error } = await createClient().rpc(
      "set_page_comment_resolved",
      {
        p_comment_id: commentId,
        p_resolved: resolved,
      },
    );
    setWorking("");
    if (error) {
      setMessage(error.message);
      return;
    }
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              resolved_at: resolved ? new Date().toISOString() : null,
            }
          : comment,
      ),
    );
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm("Delete this comment?")) return;
    setWorking(commentId);
    const { error } = await createClient().rpc("delete_page_comment", {
      p_comment_id: commentId,
    });
    setWorking("");
    if (error) {
      setMessage(error.message);
      return;
    }
    setComments((current) =>
      current.filter((comment) => comment.id !== commentId),
    );
  }

  const visibleComments = comments.filter(
    (comment) => showResolved || !comment.resolved_at,
  );
  const resolvedCount = comments.filter(
    (comment) => comment.resolved_at,
  ).length;

  return (
    <aside className="review-panel" aria-label={`Review ${pageTitle}`}>
      <header>
        <div>
          <span className="eyebrow">REVIEW</span>
          <h2>Comments &amp; suggestions</h2>
          <small>{pageTitle}</small>
        </div>
        <div>
          <button
            type="button"
            className="icon-button"
            aria-label="Refresh comments"
            title="Refresh comments"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={loading ? "spin" : ""} size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Close review"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>
      </header>

      <form className="review-composer" onSubmit={createComment}>
        <div className="review-kind-picker" role="group" aria-label="Review type">
          <button
            type="button"
            className={kind === "comment" ? "active" : ""}
            onClick={() => setKind("comment")}
          >
            <MessageSquareText size={13} />
            Comment
          </button>
          <button
            type="button"
            className={kind === "suggestion" ? "active" : ""}
            onClick={() => setKind("suggestion")}
          >
            <Lightbulb size={13} />
            Suggestion
          </button>
        </div>

        {quote ? (
          <blockquote className="review-quote">
            <Quote size={13} />
            <span>{quote}</span>
            <button
              type="button"
              aria-label="Remove quoted selection"
              onClick={() => setQuote("")}
            >
              <X size={12} />
            </button>
          </blockquote>
        ) : selectedText ? (
          <button
            type="button"
            className="use-selection-button"
            onClick={() => setQuote(selectedText.slice(0, 2000))}
          >
            <Quote size={13} />
            Quote selected text
          </button>
        ) : (
          <small className="review-selection-hint">
            Select text in the page if you want to quote it.
          </small>
        )}

        <textarea
          name="body"
          required
          maxLength={4000}
          rows={3}
          placeholder={
            kind === "comment"
              ? "Leave a thoughtful comment…"
              : "Explain what you would change…"
          }
        />
        {kind === "suggestion" && (
          <textarea
            name="suggestion"
            required
            maxLength={4000}
            rows={3}
            placeholder="Suggested replacement text…"
          />
        )}
        <button
          type="submit"
          className="primary-button"
          disabled={working === "create"}
        >
          {working === "create" ? (
            <LoaderCircle className="spin" size={14} />
          ) : (
            <Send size={14} />
          )}
          {working === "create" ? "Posting…" : "Post"}
        </button>
      </form>

      {message && <p className="review-message">{message}</p>}

      <div className="review-list-heading">
        <strong>
          {comments.filter((comment) => !comment.resolved_at).length} open
        </strong>
        {resolvedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowResolved((current) => !current)}
          >
            {showResolved ? "Hide" : "Show"} {resolvedCount} resolved
          </button>
        )}
      </div>

      <div className="review-comment-list">
        {loading ? (
          <p className="review-empty">Loading comments…</p>
        ) : visibleComments.length === 0 ? (
          <p className="review-empty">
            No open comments on this page. Select a passage or leave a general
            note.
          </p>
        ) : (
          visibleComments.map((comment) => (
            <article
              key={comment.id}
              className={`review-comment${
                comment.resolved_at ? " resolved" : ""
              }`}
            >
              <header>
                <div>
                  <strong>{comment.author_email}</strong>
                  <small>
                    {comment.kind === "suggestion" ? "Suggestion" : "Comment"} ·{" "}
                    {new Intl.DateTimeFormat(undefined, {
                      month: "short",
                      day: "numeric",
                    }).format(new Date(comment.created_at))}
                  </small>
                </div>
                <div className="review-comment-actions">
                  {canResolve &&
                    (comment.resolved_at ? (
                      <button
                        type="button"
                        aria-label="Reopen comment"
                        title="Reopen"
                        disabled={working === comment.id}
                        onClick={() => void setResolved(comment.id, false)}
                      >
                        <RotateCcw size={13} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label="Resolve comment"
                        title="Resolve"
                        disabled={working === comment.id}
                        onClick={() => void setResolved(comment.id, true)}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    ))}
                  {(comment.author_id === userId || canModerate) && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      title="Delete"
                      disabled={working === comment.id}
                      onClick={() => void deleteComment(comment.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </header>
              {comment.quoted_text && (
                <blockquote>“{comment.quoted_text}”</blockquote>
              )}
              <p>{comment.body}</p>
              {comment.suggestion_text && (
                <div className="suggested-text">
                  <span>SUGGESTED TEXT</span>
                  <p>{comment.suggestion_text}</p>
                  {canApplySuggestions &&
                    onApplySuggestion &&
                    !comment.resolved_at && (
                    <button
                      type="button"
                      className="use-selection-button"
                      onClick={() => {
                        const applied = onApplySuggestion(
                          comment.quoted_text,
                          comment.suggestion_text ?? "",
                        );
                        setMessage(
                          applied
                            ? "The suggested wording was applied to this page."
                            : "That quoted passage is no longer in this page. Copy the suggestion instead.",
                        );
                      }}
                    >
                      <ClipboardCopy size={13} />
                      Apply suggestion
                    </button>
                  )}
                </div>
              )}
              {comment.resolved_at && (
                <small className="resolved-label">
                  <CheckCircle2 size={12} />
                  Resolved
                </small>
              )}
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
