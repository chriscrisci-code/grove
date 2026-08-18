/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ArrowLeft,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ResearchLink = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  createdAt: string;
};

type SearchResult = {
  title: string;
  url: string;
  excerpt: string;
  readerText: string;
  score: number;
};

type ResearchViewProps = {
  pageId: string;
  pageTitle: string;
  cloudMode: boolean;
  userId?: string;
  readOnly?: boolean;
  onClose: () => void;
};

function webpageUrl(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!trimmed.includes(" ") && trimmed.includes(".")) return `https://${trimmed}`;
  return null;
}

export function ResearchView({
  pageId,
  pageTitle,
  cloudMode,
  userId,
  readOnly = false,
  onClose,
}: ResearchViewProps) {
  const [query, setQuery] = useState("");
  const [links, setLinks] = useState<ResearchLink[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeResult, setActiveResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cloudMode) {
        const { data, error } = await createClient()
          .from("research_links")
          .select(
            "id,url,title,description,image_url,favicon_url,created_at",
          )
          .eq("page_id", pageId)
          .order("created_at", { ascending: false });
        if (!cancelled) {
          if (error) setMessage("Research could not be loaded.");
          setLinks(
            (data ?? []).map((link) => ({
              id: link.id,
              url: link.url,
              title: link.title,
              description: link.description,
              imageUrl: link.image_url,
              faviconUrl: link.favicon_url,
              createdAt: link.created_at,
            })),
          );
        }
      } else {
        const stored = localStorage.getItem(`grove-research:${pageId}`);
        if (!cancelled && stored) {
          try {
            setLinks(JSON.parse(stored) as ResearchLink[]);
          } catch {
            localStorage.removeItem(`grove-research:${pageId}`);
          }
        }
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [cloudMode, pageId]);

  async function searchResearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setMessage("");
    setActiveResult(null);
    try {
      const response = await fetch("/api/research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = (await response.json()) as {
        error?: string;
        results?: SearchResult[];
      };
      if (!response.ok) throw new Error(body.error || "Search failed.");
      setResults(body.results ?? []);
      if (!body.results?.length) setMessage("No results matched that search.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function saveLink(value = query) {
    if (readOnly) {
      setMessage("Research is read-only for this story.");
      return;
    }
    const url = webpageUrl(value);
    if (!url) {
      setMessage("Paste a webpage URL here before choosing Save link.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/research/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const preview = (await response.json()) as {
        error?: string;
        url: string;
        title: string;
        description: string;
        imageUrl: string | null;
        faviconUrl: string | null;
      };
      if (!response.ok) throw new Error(preview.error || "The link could not be saved.");

      let saved: ResearchLink;
      if (cloudMode && userId) {
        const { data, error } = await createClient()
          .from("research_links")
          .insert({
            page_id: pageId,
            created_by: userId,
            url: preview.url,
            title: preview.title,
            description: preview.description || null,
            image_url: preview.imageUrl,
            favicon_url: preview.faviconUrl,
          })
          .select(
            "id,url,title,description,image_url,favicon_url,created_at",
          )
          .single();
        if (error || !data) throw new Error("The link could not be stored.");
        saved = {
          id: data.id,
          url: data.url,
          title: data.title,
          description: data.description,
          imageUrl: data.image_url,
          faviconUrl: data.favicon_url,
          createdAt: data.created_at,
        };
      } else {
        saved = {
          id: crypto.randomUUID(),
          url: preview.url,
          title: preview.title,
          description: preview.description || null,
          imageUrl: preview.imageUrl,
          faviconUrl: preview.faviconUrl,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem(
          `grove-research:${pageId}`,
          JSON.stringify([saved, ...links]),
        );
      }
      setLinks((current) => [saved, ...current]);
      if (value === query) setQuery("");
      setMessage("Link saved to this page.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The link could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(id: string) {
    if (readOnly) {
      setMessage("Research is read-only for this story.");
      return;
    }
    if (cloudMode) {
      const { error } = await createClient()
        .from("research_links")
        .delete()
        .eq("id", id);
      if (error) {
        setMessage("The saved link could not be removed.");
        return;
      }
    }
    const remaining = links.filter((link) => link.id !== id);
    setLinks(remaining);
    if (!cloudMode) {
      localStorage.setItem(
        `grove-research:${pageId}`,
        JSON.stringify(remaining),
      );
    }
  }

  return (
    <section className="research-view">
      <header className="research-heading">
        <div>
          <span className="eyebrow">RESEARCH FOR</span>
          <h1>{pageTitle}</h1>
          <p>
            Search and read the web without leaving Grove. Save useful sources
            here to keep them with this entry.
          </p>
        </div>
        <button
          type="button"
          className="research-close"
          onClick={onClose}
          aria-label="Return to writing"
        >
          <X size={17} />
          Return to writing
        </button>
      </header>

      <form className="research-search" onSubmit={searchResearch}>
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the web or paste a webpage URL…"
          aria-label="Web search or webpage URL"
        />
        <button type="submit" className="secondary-button">
          {searching ? (
            <LoaderCircle className="spin" size={14} />
          ) : (
            <Search size={14} />
          )}
          {searching ? "Searching…" : "Search Grove"}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={saving || readOnly}
          onClick={() => void saveLink()}
        >
          {saving ? <LoaderCircle className="spin" size={14} /> : <Globe2 size={14} />}
          {saving ? "Saving…" : "Save link"}
        </button>
      </form>

      {message && <p className="research-message">{message}</p>}

      {(results.length > 0 || activeResult) && (
        <div
          className={`research-browser ${activeResult ? "reader-open" : ""}`}
        >
          <aside className="research-results" aria-label="Search results">
            <div className="research-results-title">
              <span>SEARCH RESULTS</span>
              <strong>{results.length}</strong>
            </div>
            {results.map((result) => (
              <button
                type="button"
                key={result.url}
                className={activeResult?.url === result.url ? "active" : ""}
                onClick={() => setActiveResult(result)}
              >
                <small>{new URL(result.url).hostname.replace(/^www\./, "")}</small>
                <strong>{result.title}</strong>
                <span>{result.excerpt}</span>
              </button>
            ))}
          </aside>
          <article className="research-reader">
            {activeResult ? (
              <>
                <button
                  type="button"
                  className="reader-back"
                  onClick={() => setActiveResult(null)}
                >
                  <ArrowLeft size={15} />
                  Back to results
                </button>
                <header>
                  <div>
                    <span className="eyebrow">READER PREVIEW</span>
                    <h2>{activeResult.title}</h2>
                    <small>
                      {new URL(activeResult.url).hostname.replace(/^www\./, "")}
                    </small>
                  </div>
                  <div className="reader-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={saving || readOnly}
                      onClick={() => void saveLink(activeResult.url)}
                    >
                      <Globe2 size={14} />
                      Save source
                    </button>
                    <a
                      href={activeResult.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open original website"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </header>
                <div className="reader-content">
                  {activeResult.readerText || activeResult.excerpt}
                </div>
              </>
            ) : (
              <div className="reader-placeholder">
                <Globe2 size={32} />
                <h3>Select a search result</h3>
                <p>Its readable preview will open here inside Grove.</p>
              </div>
            )}
          </article>
        </div>
      )}

      <div className="research-library">
        <div className="research-library-heading">
          <h2>Saved sources</h2>
          <span>{links.length} {links.length === 1 ? "source" : "sources"}</span>
        </div>
        {loading ? (
          <div className="research-empty">
            <LoaderCircle className="spin" size={21} />
            Loading research…
          </div>
        ) : links.length ? (
          <div className="research-grid">
            {links.map((link) => (
              <article className="research-card" key={link.id}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  <div className="research-thumbnail">
                    {link.imageUrl ? (
                      <img src={link.imageUrl} alt="" />
                    ) : (
                      <Globe2 size={30} />
                    )}
                  </div>
                  <div className="research-card-copy">
                    <div className="research-domain">
                      {link.faviconUrl && <img src={link.faviconUrl} alt="" />}
                      {new URL(link.url).hostname.replace(/^www\./, "")}
                    </div>
                    <h3>{link.title}</h3>
                    {link.description && <p>{link.description}</p>}
                  </div>
                </a>
                {!readOnly && (
                  <button
                    type="button"
                    className="research-delete"
                    onClick={() => void removeLink(link.id)}
                    aria-label={`Remove ${link.title}`}
                    title="Remove saved link"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="research-empty">
            <Globe2 size={30} />
            <h3>No saved research yet</h3>
            <p>Search for something above, then paste and save a useful URL.</p>
          </div>
        )}
      </div>
    </section>
  );
}
