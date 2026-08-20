/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ArrowLeft,
  ExternalLink,
  Globe2,
  ImagePlus,
  LoaderCircle,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  DragEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  RESEARCH_IMAGE_ACCEPT,
  RESEARCH_IMAGE_URL,
  RESEARCH_IMAGES_BUCKET,
  attachSignedImageUrls,
  collectImageFiles,
  isResearchImage,
  researchImageTitle,
  type ResearchItem,
  type ResearchKind,
} from "@/features/research/research-images";

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

type ResearchRow = {
  id: string;
  kind?: string | null;
  url: string;
  title: string;
  description: string | null;
  image_url: string | null;
  favicon_url: string | null;
  storage_path?: string | null;
  created_at: string;
};

function webpageUrl(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!trimmed.includes(" ") && trimmed.includes(".")) return `https://${trimmed}`;
  return null;
}

function mapRow(row: ResearchRow): ResearchItem {
  const kind: ResearchKind = row.kind === "image" ? "image" : "link";
  return {
    id: row.id,
    kind,
    url: row.url,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    faviconUrl: row.favicon_url,
    storagePath: row.storage_path ?? null,
    createdAt: row.created_at,
  };
}

async function fileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The image could not be read."));
    };
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

function persistLocal(pageId: string, items: ResearchItem[]) {
  localStorage.setItem(`grove-research:${pageId}`, JSON.stringify(items));
}

export function ResearchView({
  pageId,
  pageTitle,
  cloudMode,
  userId,
  readOnly = false,
  onClose,
}: ResearchViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [query, setQuery] = useState("");
  const [links, setLinks] = useState<ResearchItem[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeResult, setActiveResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cloudMode) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("research_links")
          .select(
            "id,kind,url,title,description,image_url,favicon_url,storage_path,created_at",
          )
          .eq("page_id", pageId)
          .order("created_at", { ascending: false });
        if (!cancelled) {
          if (error) setMessage("Research could not be loaded.");
          const mapped = (data ?? []).map((row) => mapRow(row as ResearchRow));
          const paths = mapped
            .map((item) => item.storagePath)
            .filter((path): path is string => Boolean(path));
          if (paths.length) {
            const { data: signed } = await supabase.storage
              .from(RESEARCH_IMAGES_BUCKET)
              .createSignedUrls(paths, 3600);
            setLinks(
              attachSignedImageUrls(
                mapped,
                (signed ?? []).flatMap((entry) => {
                  const signedUrl = entry.signedUrl ?? entry.signedURL;
                  return entry.path && signedUrl
                    ? [{ path: entry.path, signedUrl }]
                    : [];
                }),
              ),
            );
          } else {
            setLinks(mapped);
          }
        }
      } else {
        const stored = localStorage.getItem(`grove-research:${pageId}`);
        if (!cancelled && stored) {
          try {
            const parsed = JSON.parse(stored) as ResearchItem[];
            setLinks(
              parsed.map((item) => ({
                ...item,
                kind: item.kind === "image" ? "image" : "link",
                storagePath: item.storagePath ?? null,
              })),
            );
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

      let saved: ResearchItem;
      if (cloudMode && userId) {
        const { data, error } = await createClient()
          .from("research_links")
          .insert({
            page_id: pageId,
            created_by: userId,
            kind: "link",
            url: preview.url,
            title: preview.title,
            description: preview.description || null,
            image_url: preview.imageUrl,
            favicon_url: preview.faviconUrl,
          })
          .select(
            "id,kind,url,title,description,image_url,favicon_url,storage_path,created_at",
          )
          .single();
        if (error || !data) throw new Error("The link could not be stored.");
        saved = mapRow(data as ResearchRow);
      } else {
        saved = {
          id: crypto.randomUUID(),
          kind: "link",
          url: preview.url,
          title: preview.title,
          description: preview.description || null,
          imageUrl: preview.imageUrl,
          faviconUrl: preview.faviconUrl,
          storagePath: null,
          createdAt: new Date().toISOString(),
        };
        persistLocal(pageId, [saved, ...links]);
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

  async function saveImages(files: File[]) {
    if (readOnly) {
      setMessage("Research is read-only for this story.");
      return;
    }
    const images = collectImageFiles(files);
    if (!images.length) {
      setMessage("Drop a JPEG, PNG, or WebP image.");
      return;
    }
    setUploading(true);
    setMessage("");
    const savedItems: ResearchItem[] = [];
    try {
      for (const file of images) {
        if (cloudMode) {
          const body = new FormData();
          body.set("pageId", pageId);
          body.set("image", file);
          const response = await fetch("/api/research/image", {
            method: "POST",
            body,
          });
          const saved = (await response.json()) as ResearchItem & {
            error?: string;
          };
          if (!response.ok) {
            throw new Error(saved.error || "The image could not be saved.");
          }
          savedItems.push({
            ...saved,
            kind: "image",
            storagePath: saved.storagePath ?? null,
          });
        } else {
          const imageUrl = await fileAsDataUrl(file);
          savedItems.push({
            id: crypto.randomUUID(),
            kind: "image",
            url: RESEARCH_IMAGE_URL,
            title: researchImageTitle(file.name),
            description: null,
            imageUrl,
            faviconUrl: null,
            storagePath: null,
            createdAt: new Date().toISOString(),
          });
        }
      }
      if (!cloudMode) {
        try {
          persistLocal(pageId, [...savedItems, ...links]);
        } catch {
          throw new Error("This image is too large to keep in the demo.");
        }
      }
      setLinks((current) => [...savedItems, ...current]);
      setMessage(
        savedItems.length === 1
          ? "Image saved to this page."
          : `${savedItems.length} images saved to this page.`,
      );
    } catch (error) {
      if (savedItems.length && cloudMode) {
        setLinks((current) => [...savedItems, ...current]);
      }
      setMessage(
        error instanceof Error ? error.message : "The image could not be saved.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function removeLink(id: string) {
    if (readOnly) {
      setMessage("Research is read-only for this story.");
      return;
    }
    const target = links.find((item) => item.id === id);
    if (cloudMode) {
      const supabase = createClient();
      if (target?.storagePath) {
        const { error: storageError } = await supabase.storage
          .from(RESEARCH_IMAGES_BUCKET)
          .remove([target.storagePath]);
        if (storageError) {
          setMessage("The saved image could not be removed.");
          return;
        }
      }
      const { error } = await supabase.from("research_links").delete().eq("id", id);
      if (error) {
        setMessage("The saved item could not be removed.");
        return;
      }
    }
    const remaining = links.filter((item) => item.id !== id);
    setLinks(remaining);
    if (!cloudMode) persistLocal(pageId, remaining);
  }

  function hasFiles(event: DragEvent) {
    return event.dataTransfer.types.includes("Files");
  }

  function onDragEnter(event: DragEvent<HTMLElement>) {
    if (readOnly || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    if (readOnly || !hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(event: DragEvent<HTMLElement>) {
    if (readOnly || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    if (readOnly) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void saveImages([...event.dataTransfer.files]);
  }

  return (
    <section className="research-view">
      <header className="research-heading">
        <div>
          <span className="eyebrow">RESEARCH FOR</span>
          <h1>{pageTitle}</h1>
          <p>
            Search the web, save a source, or drop an image onto this page.
            Saved research stays with this entry.
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

      <div
        className={`research-library${dragging ? " dragging" : ""}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="research-library-heading">
          <h2>Saved sources</h2>
          <div className="research-library-actions">
            <span>{links.length} {links.length === 1 ? "source" : "sources"}</span>
            {!readOnly && (
              <button
                type="button"
                className="secondary-button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <ImagePlus size={14} />
                )}
                {uploading ? "Saving…" : "Add image"}
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={RESEARCH_IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(event) => {
            void saveImages([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
        {dragging && !readOnly && (
          <div className="research-drop-hint">
            <ImagePlus size={22} />
            Drop images onto this page
          </div>
        )}
        {loading ? (
          <div className="research-empty">
            <LoaderCircle className="spin" size={21} />
            Loading research…
          </div>
        ) : links.length ? (
          <div className="research-grid">
            {links.map((item) => {
              const image = isResearchImage(item);
              const href = image ? item.imageUrl : item.url;
              const domain = image
                ? "Image"
                : new URL(item.url).hostname.replace(/^www\./, "");
              const card = (
                <>
                  <div className="research-thumbnail">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" />
                    ) : image ? (
                      <ImagePlus size={30} />
                    ) : (
                      <Globe2 size={30} />
                    )}
                  </div>
                  <div className="research-card-copy">
                    <div className="research-domain">
                      {!image && item.faviconUrl && (
                        <img src={item.faviconUrl} alt="" />
                      )}
                      {domain}
                    </div>
                    <h3>{item.title}</h3>
                    {item.description && <p>{item.description}</p>}
                  </div>
                </>
              );
              return (
                <article className="research-card" key={item.id}>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer">
                      {card}
                    </a>
                  ) : (
                    <div>{card}</div>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      className="research-delete"
                      onClick={() => void removeLink(item.id)}
                      aria-label={`Remove ${item.title}`}
                      title="Remove saved item"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="research-empty">
            <Globe2 size={30} />
            <h3>No saved research yet</h3>
            <p>
              Search above, save a URL, or drop a JPEG, PNG, or WebP image here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
