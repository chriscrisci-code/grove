"use client";

import {
  BookOpen,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  FileText,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StoryEditor } from "@/features/editor/story-editor";
import { createClient } from "@/lib/supabase/client";

export type StoryPage = {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  updatedAt: number;
};

type AiProvider = "openai" | "anthropic" | "google";

const initialPages: StoryPage[] = [
  {
    id: "welcome",
    parentId: null,
    title: "Welcome to StoryTree",
    content:
      "<p>Your story begins here. StoryTree keeps every character, place, and idea within reach.</p><h2>Try a quick link</h2><p>Type a name like <strong>Evermere</strong>, place your cursor after it, and press <strong>Alt+P</strong>. A linked child page will appear instantly.</p><p>Press <strong>Alt+A</strong> whenever you want to think alongside AI.</p>",
    updatedAt: Date.now(),
  },
  {
    id: "characters",
    parentId: null,
    title: "Characters",
    content: "<p>Keep the people at the heart of your story here.</p>",
    updatedAt: Date.now() - 1000,
  },
  {
    id: "mara",
    parentId: "characters",
    title: "Mara Venn",
    content:
      "<h2>Role</h2><p>Protagonist</p><h2>Wants</h2><p>To discover what happened beyond the northern ridge.</p>",
    updatedAt: Date.now() - 2000,
  },
  {
    id: "places",
    parentId: null,
    title: "Places",
    content: "<p>Map the places that shape your world.</p>",
    updatedAt: Date.now() - 3000,
  },
];

function makeId() {
  return crypto.randomUUID();
}

type WorkspaceProps = {
  initialCloudPages?: StoryPage[];
  workspaceId?: string;
  userId?: string;
  userEmail?: string;
};

export function Workspace({
  initialCloudPages,
  workspaceId,
  userId,
  userEmail,
}: WorkspaceProps = {}) {
  const router = useRouter();
  const cloudMode = Boolean(workspaceId && userId);
  const startingPages =
    initialCloudPages?.length ? initialCloudPages : initialPages;
  const [pages, setPages] = useState(startingPages);
  const [activeId, setActiveId] = useState(startingPages[0]?.id ?? "welcome");
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["characters"]),
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selection, setSelection] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState("gpt-5-mini");
  const [apiKey, setApiKey] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const deletingIds = useRef(new Set<string>());

  useEffect(() => {
    if (cloudMode) return;
    const raw = localStorage.getItem("storytree-pages");
    const storedActiveId = localStorage.getItem("storytree-active-page");
    const storedProvider = localStorage.getItem("storytree-ai-provider");
    const storedModel = localStorage.getItem("storytree-ai-model");
    queueMicrotask(() => {
      if (raw) {
        try {
          const restored = JSON.parse(raw) as StoryPage[];
          if (restored.length) setPages(restored);
        } catch {
          localStorage.removeItem("storytree-pages");
        }
      }
      if (storedActiveId) setActiveId(storedActiveId);
      if (
        storedProvider === "openai" ||
        storedProvider === "anthropic" ||
        storedProvider === "google"
      ) {
        setProvider(storedProvider);
      }
      if (storedModel) setModel(storedModel);
    });
  }, [cloudMode]);

  useEffect(() => {
    if (!cloudMode) return;
    fetch("/api/ai/settings")
      .then((response) => response.json())
      .then(
        (settings: {
          provider?: AiProvider;
          model?: string;
          hasKey?: boolean;
        }) => {
          if (settings.provider) setProvider(settings.provider);
          if (settings.model) setModel(settings.model);
          setHasStoredKey(Boolean(settings.hasKey));
        },
      )
      .catch(() => setHasStoredKey(false));
  }, [cloudMode]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (cloudMode && workspaceId && userId) {
        const supabase = createClient();
        const { error } = await supabase.from("pages").upsert(
          pages
            .filter((page) => !deletingIds.current.has(page.id))
            .map((page, position) => ({
              id: page.id,
              workspace_id: workspaceId,
              parent_id: page.parentId,
              title: page.title || "Untitled",
              content: { html: page.content },
              position,
              created_by: userId,
            })),
          { onConflict: "id" },
        );
        if (error) {
          setNotice("Cloud save failed. Your text is still on screen.");
          return;
        }
      } else {
        localStorage.setItem("storytree-pages", JSON.stringify(pages));
        localStorage.setItem("storytree-active-page", activeId);
      }
      setSavedAt(Date.now());
    }, 450);
    return () => window.clearTimeout(timer);
  }, [pages, activeId, cloudMode, userId, workspaceId]);

  useEffect(() => {
    function openAi(event: KeyboardEvent) {
      if (
        event.altKey &&
        event.key.toLowerCase() === "a" &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        setAiOpen(true);
      }
    }
    window.addEventListener("keydown", openAi);
    return () => window.removeEventListener("keydown", openAi);
  }, []);

  const activePage = pages.find((page) => page.id === activeId) ?? pages[0];
  const filteredPages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? pages.filter((page) => page.title.toLowerCase().includes(query))
      : pages;
  }, [pages, search]);

  const createPage = useCallback(
    (parentId: string | null = null, title = "Untitled") => {
      const page: StoryPage = {
        id: makeId(),
        parentId,
        title,
        content: "<p></p>",
        updatedAt: Date.now(),
      };
      setPages((current) => [...current, page]);
      if (parentId) {
        setExpanded((current) => new Set(current).add(parentId));
      }
      setActiveId(page.id);
      return page;
    },
    [],
  );

  const createLinkedPage = useCallback(
    (title: string, applyLink: (href: string) => void) => {
      const existing = pages.find(
        (page) =>
          page.parentId === activeId &&
          page.title.toLowerCase() === title.toLowerCase(),
      );
      const page = existing ?? createPage(activeId, title);
      applyLink(`#page-${page.id}`);
      setNotice(existing ? `Linked to ${page.title}` : `Created ${page.title}`);
      window.setTimeout(() => setNotice(""), 2200);
    },
    [activeId, createPage, pages],
  );

  const updateActivePage = useCallback(
    (patch: Partial<Pick<StoryPage, "title" | "content">>) => {
      setPages((current) =>
        current.map((page) =>
          page.id === activeId
            ? { ...page, ...patch, updatedAt: Date.now() }
            : page,
        ),
      );
    },
    [activeId],
  );

  const deletePage = useCallback(
    async (id: string) => {
      const target = pages.find((page) => page.id === id);
      if (!target) return;
      const confirmed = window.confirm(
        `Delete “${target.title || "Untitled"}” and all pages inside it?`,
      );
      if (!confirmed) return;

      const deletedIds = new Set([id]);
      let foundChild = true;
      while (foundChild) {
        foundChild = false;
        pages.forEach((page) => {
          if (
            page.parentId &&
            deletedIds.has(page.parentId) &&
            !deletedIds.has(page.id)
          ) {
            deletedIds.add(page.id);
            foundChild = true;
          }
        });
      }
      deletedIds.forEach((deletedId) => deletingIds.current.add(deletedId));

      if (cloudMode) {
        const { error } = await createClient()
          .from("pages")
          .delete()
          .eq("id", id);
        if (error) {
          deletedIds.forEach((deletedId) =>
            deletingIds.current.delete(deletedId),
          );
          setNotice("This page could not be deleted.");
          return;
        }
      }

      let remaining = pages.filter((page) => !deletedIds.has(page.id));
      if (!remaining.length) {
        remaining = [
          {
            id: makeId(),
            parentId: null,
            title: "Untitled",
            content: "<p></p>",
            updatedAt: Date.now(),
          },
        ];
      }
      setPages(remaining);
      if (deletedIds.has(activeId)) {
        const parent = remaining.find((page) => page.id === target.parentId);
        setActiveId(parent?.id ?? remaining[0].id);
      }
      setExpanded((current) => {
        const next = new Set(current);
        deletedIds.forEach((deletedId) => next.delete(deletedId));
        return next;
      });
      setNotice(`Deleted ${target.title || "Untitled"}`);
      window.setTimeout(() => setNotice(""), 2200);
    },
    [activeId, cloudMode, pages],
  );

  const openAi = useCallback((selectedText = "") => {
    setSelection(selectedText);
    setAiOpen(true);
  }, []);

  if (!activePage) return null;

  return (
    <main className="workspace-shell">
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">
              <BookOpen size={18} />
            </span>
            <span>StoryTree</span>
            <button
              type="button"
              className="icon-button sidebar-close"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeftClose size={17} />
            </button>
          </div>

          <div className="sidebar-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find anything…"
              aria-label="Search pages"
            />
            <kbd>⌘ K</kbd>
          </div>

          <div className="sidebar-label">
            <span>Your story</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Create root page"
              onClick={() => createPage()}
            >
              <Plus size={15} />
            </button>
          </div>

          <nav className="page-tree" aria-label="Story pages">
            <PageBranch
              pages={filteredPages}
              allPages={pages}
              parentId={null}
              activeId={activeId}
              expanded={expanded}
              onSelect={setActiveId}
              onToggle={(id) =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onAdd={createPage}
              onDelete={deletePage}
            />
          </nav>

          <div className="sidebar-footer">
            <button type="button" onClick={() => setSettingsOpen(true)}>
              <Settings size={16} />
              Settings
            </button>
            {cloudMode ? (
              <button
                type="button"
                className="sign-out"
                title={`Sign out${userEmail ? ` ${userEmail}` : ""}`}
                aria-label="Sign out"
                onClick={async () => {
                  await createClient().auth.signOut();
                  router.refresh();
                }}
              >
                <span className="user-avatar">
                  {userEmail?.charAt(0).toUpperCase() || "W"}
                </span>
                <LogOut size={14} />
              </button>
            ) : (
              <div className="user-avatar">C</div>
            )}
          </div>
        </aside>
      )}

      <section className="document-pane">
        <header className="topbar">
          <div className="breadcrumbs">
            {!sidebarOpen && (
              <button
                type="button"
                className="icon-button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <BookOpen size={18} />
              </button>
            )}
            <span>My Story</span>
            <ChevronRight size={14} />
            <strong>{activePage.title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="save-state">
              {savedAt ? "Saved" : "Saving…"}
            </span>
            <button
              type="button"
              className="ai-button"
              onClick={() => openAi()}
            >
              <Sparkles size={15} />
              Ask AI
              <kbd>Alt A</kbd>
            </button>
            <button type="button" className="icon-button" aria-label="More">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>

        <article className="document">
          <div className="document-meta">
            <span>PAGE</span>
            <span>•</span>
            <span>Edited just now</span>
          </div>
          <input
            className="document-title"
            value={activePage.title}
            onChange={(event) =>
              updateActivePage({ title: event.target.value })
            }
            aria-label="Page title"
          />
          <StoryEditor
            key={activePage.id}
            content={activePage.content}
            onChange={(content) => updateActivePage({ content })}
            onCreatePage={createLinkedPage}
            onOpenAi={openAi}
          />
        </article>
      </section>

      {aiOpen && (
        <AiPanel
          provider={provider}
          model={model}
          selection={selection}
          apiKey={cloudMode ? "" : apiKey}
          hasKey={Boolean(apiKey) || hasStoredKey}
          onClose={() => setAiOpen(false)}
          onSettings={() => setSettingsOpen(true)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          provider={provider}
          model={model}
          apiKey={apiKey}
          secureStorage={cloudMode}
          onClose={() => setSettingsOpen(false)}
          onSave={async (nextProvider, nextModel, nextKey) => {
            if (cloudMode) {
              const response = await fetch("/api/ai/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  provider: nextProvider,
                  model: nextModel,
                  apiKey: nextKey,
                }),
              });
              if (!response.ok) {
                setNotice("AI settings could not be saved.");
                return;
              }
              setHasStoredKey(true);
            } else {
              setApiKey(nextKey);
              localStorage.setItem("storytree-ai-provider", nextProvider);
              localStorage.setItem("storytree-ai-model", nextModel);
            }
            setProvider(nextProvider);
            setModel(nextModel);
            setSettingsOpen(false);
            setNotice("AI settings saved");
            window.setTimeout(() => setNotice(""), 2200);
          }}
        />
      )}

      {notice && <div className="notice">{notice}</div>}
    </main>
  );
}

type PageBranchProps = {
  pages: StoryPage[];
  allPages: StoryPage[];
  parentId: string | null;
  activeId: string;
  expanded: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAdd: (parentId: string, title?: string) => StoryPage;
  onDelete: (id: string) => void;
};

function PageBranch({
  pages,
  allPages,
  parentId,
  activeId,
  expanded,
  onSelect,
  onToggle,
  onAdd,
  onDelete,
}: PageBranchProps) {
  return pages
    .filter((page) => page.parentId === parentId)
    .map((page) => {
      const hasChildren = allPages.some((child) => child.parentId === page.id);
      return (
        <div key={page.id}>
          <div className={`page-row ${activeId === page.id ? "active" : ""}`}>
            <button
              type="button"
              className="tree-toggle"
              aria-label={expanded.has(page.id) ? "Collapse" : "Expand"}
              onClick={() => onToggle(page.id)}
            >
              {hasChildren ? (
                expanded.has(page.id) ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )
              ) : (
                <span />
              )}
            </button>
            <button
              type="button"
              className="page-name"
              onClick={() => onSelect(page.id)}
            >
              <FileText size={15} />
              <span>{page.title || "Untitled"}</span>
            </button>
            <button
              type="button"
              className="row-add"
              aria-label={`Add page under ${page.title}`}
              onClick={() => onAdd(page.id)}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              className="row-delete"
              aria-label={`Delete ${page.title}`}
              title="Delete page"
              onClick={() => onDelete(page.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
          {expanded.has(page.id) && (
            <div className="tree-children">
              <PageBranch
                pages={pages}
                allPages={allPages}
                parentId={page.id}
                activeId={activeId}
                expanded={expanded}
                onSelect={onSelect}
                onToggle={onToggle}
                onAdd={onAdd}
                onDelete={onDelete}
              />
            </div>
          )}
        </div>
      );
    });
}

function AiPanel({
  provider,
  model,
  selection,
  apiKey,
  hasKey,
  onClose,
  onSettings,
}: {
  provider: AiProvider;
  model: string;
  selection: string;
  apiKey: string;
  hasKey: boolean;
  onClose: () => void;
  onSettings: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function askAi() {
    if (!prompt.trim() || !hasKey || loading) return;
    setLoading(true);
    setAnswer("");
    setError("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          apiKey: apiKey || undefined,
          prompt,
          context: selection || undefined,
        }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "The AI request failed.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setAnswer((current) => current + decoder.decode(value));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The AI request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="ai-panel">
      <header>
        <div>
          <span className="ai-orb">
            <BrainCircuit size={18} />
          </span>
          <div>
            <strong>StoryTree AI</strong>
            <small>
              {provider} · {model}
            </small>
          </div>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close AI"
        >
          <X size={18} />
        </button>
      </header>
      <div className="ai-body">
        <div className="ai-welcome">
          <Sparkles size={22} />
          <h2>What are we exploring?</h2>
          <p>
            Brainstorm, deepen a character, rewrite a passage, or untangle a
            plot.
          </p>
        </div>
        {selection && (
          <div className="selection-card">
            <span>Using selection</span>
            <p>{selection}</p>
          </div>
        )}
        {!hasKey && (
          <button type="button" className="connect-card" onClick={onSettings}>
            <Settings size={17} />
            <span>
              <strong>Connect an AI provider</strong>
              <small>Add your own API key in Settings</small>
            </span>
            <ChevronRight size={16} />
          </button>
        )}
        {(answer || loading || error) && (
          <div className="ai-response" aria-live="polite">
            <span>STORYTREE</span>
            {answer && <p>{answer}</p>}
            {loading && <small>Thinking with your story…</small>}
            {error && <p className="ai-error">{error}</p>}
          </div>
        )}
      </div>
      <div className="ai-composer">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void askAi();
            }
          }}
          placeholder="Ask about your story…"
          rows={3}
        />
        <div>
          <span>AI never edits without your approval</span>
          <button
            type="button"
            disabled={!prompt.trim() || !hasKey || loading}
            onClick={() => void askAi()}
          >
            <Sparkles size={15} />
            {loading ? "Working…" : "Send"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function SettingsDialog({
  provider,
  model,
  apiKey,
  secureStorage,
  onClose,
  onSave,
}: {
  provider: AiProvider;
  model: string;
  apiKey: string;
  secureStorage: boolean;
  onClose: () => void;
  onSave: (provider: AiProvider, model: string, apiKey: string) => void;
}) {
  const [nextProvider, setNextProvider] = useState(provider);
  const [nextModel, setNextModel] = useState(model);
  const [nextKey, setNextKey] = useState(apiKey);
  const models: Record<AiProvider, string[]> = {
    openai: ["gpt-5-mini", "gpt-5.2", "gpt-4.1"],
    anthropic: ["claude-sonnet-4-6", "claude-opus-4-6"],
    google: ["gemini-3-flash", "gemini-3-pro"],
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header>
          <div>
            <span className="eyebrow">SETTINGS</span>
            <h2 id="settings-title">AI connection</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </header>
        <div className="settings-content">
          <label>
            Provider
            <select
              value={nextProvider}
              onChange={(event) => {
                const value = event.target.value as AiProvider;
                setNextProvider(value);
                setNextModel(models[value][0]);
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google Gemini</option>
            </select>
          </label>
          <label>
            Model
            <select
              value={nextModel}
              onChange={(event) => setNextModel(event.target.value)}
            >
              {models[nextProvider].map((name) => (
                <option value={name} key={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            API key
            <input
              type="password"
              value={nextKey}
              onChange={(event) => setNextKey(event.target.value)}
              placeholder={
                secureStorage
                  ? "Paste a key to save or replace"
                  : "Paste your provider API key"
              }
              autoComplete="off"
            />
          </label>
          <p className="security-note">
            {secureStorage
              ? "Your key is encrypted before database storage and is never returned to this browser."
              : "Your key stays in memory and disappears when the tab closes."}
          </p>
        </div>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => onSave(nextProvider, nextModel, nextKey)}
          >
            Save connection
          </button>
        </footer>
      </section>
    </div>
  );
}
