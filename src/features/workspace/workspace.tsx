"use client";

import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  GitFork,
  GripVertical,
  LibraryBig,
  LogOut,
  Menu,
  PanelLeftClose,
  Plus,
  Printer,
  Search,
  Settings,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { StoryEditor } from "@/features/editor/story-editor";
import { RelationshipsView } from "@/features/relationships/relationships-view";
import {
  isTimelinePageType,
  serializeTimelineLane,
  serializeTimelineY,
  withoutTimelineY,
} from "@/features/relationships/timeline";
import { ResearchView } from "@/features/research/research-view";
import { ManuscriptPreview } from "@/features/workspace/manuscript-preview";
import { HelpDialog } from "@/features/workspace/help-dialog";
import { createClient } from "@/lib/supabase/client";
import {
  applyPageDrop,
  applyPageTypeChange,
  dropPlacementFromOffset,
  reorderAmong,
  type PageDrop,
} from "@/features/workspace/page-tree";
import {
  PAGE_TYPE_FIELDS,
  PAGE_TYPE_LABELS,
  PAGE_TYPES,
  RELATIONSHIP_SUGGESTIONS,
  normalizePageFields,
  normalizePageType,
  pageTypeHasAka,
  parseAkaNames,
  type PageType,
  type StoryRelationship,
} from "@/features/workspace/page-types";

export type StoryPage = {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  pageType: PageType;
  fields: Record<string, string>;
  unvisited: boolean;
  updatedAt: number;
};

export type StoryTag = {
  id: string;
  name: string;
};

type AiProvider = "openai" | "anthropic" | "google";

const initialPages: StoryPage[] = [
  {
    id: "welcome",
    parentId: null,
    title: "Welcome to Grove",
    content:
      "<p>Your story begins here. Grove keeps every character, place, and idea within reach.</p><h2>Try a quick link</h2><p>Type a name like <strong>Evermere</strong>, place your cursor after it, and press <strong>Alt+P</strong>. A linked child page will appear instantly.</p><p>Press <strong>Alt+A</strong> whenever you want to think alongside AI.</p>",
    unvisited: false,
    pageType: "page",
    fields: {},
    updatedAt: Date.now(),
  },
  {
    id: "characters",
    parentId: null,
    title: "Characters",
    content: "<p>Keep the people at the heart of your story here.</p>",
    unvisited: false,
    pageType: "page",
    fields: {},
    updatedAt: Date.now() - 1000,
  },
  {
    id: "mara",
    parentId: "characters",
    title: "Mara Venn",
    content:
      "<h2>Role</h2><p>Protagonist</p><h2>Wants</h2><p>To discover what happened beyond the northern ridge.</p>",
    unvisited: false,
    pageType: "character",
    fields: { role: "Protagonist", wants: "To discover what happened beyond the northern ridge." },
    updatedAt: Date.now() - 2000,
  },
  {
    id: "places",
    parentId: null,
    title: "Places",
    content: "<p>Map the places that shape your world.</p>",
    unvisited: false,
    pageType: "page",
    fields: {},
    updatedAt: Date.now() - 3000,
  },
];

function makeId() {
  return crypto.randomUUID();
}

type WorkspaceProps = {
  initialCloudPages?: StoryPage[];
  initialTags?: StoryTag[];
  initialPageTags?: Record<string, string[]>;
  initialRelationships?: StoryRelationship[];
  workspaceId?: string;
  workspaceName?: string;
  userId?: string;
  userEmail?: string;
};

export function Workspace({
  initialCloudPages,
  initialTags = [],
  initialPageTags = {},
  initialRelationships = [],
  workspaceId,
  workspaceName = "My Story",
  userId,
  userEmail,
}: WorkspaceProps = {}) {
  const router = useRouter();
  const cloudMode = Boolean(workspaceId && userId);
  const startingPages =
    initialCloudPages?.length ? initialCloudPages : initialPages;
  const [pages, setPages] = useState(startingPages);
  const [tags, setTags] = useState(initialTags);
  const [pageTags, setPageTags] =
    useState<Record<string, string[]>>(initialPageTags);
  const [relationships, setRelationships] = useState(initialRelationships);
  const [tagTargetId, setTagTargetId] = useState<string | null>(null);
  const [tagPickerTargetId, setTagPickerTargetId] = useState<string | null>(
    null,
  );
  const [relatePicker, setRelatePicker] = useState<{
    fromId: string;
    toId?: string;
  } | null>(null);
  const [chaptersOpen, setChaptersOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [relationshipsOpen, setRelationshipsOpen] = useState(false);
  const [activeId, setActiveId] = useState(startingPages[0]?.id ?? "welcome");
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["characters"]),
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(274);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagPanelHeight, setTagPanelHeight] = useState(180);
  const [expandedTagId, setExpandedTagId] = useState<string | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selection, setSelection] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState("gpt-5-mini");
  const [apiKey, setApiKey] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<PageDrop | null>(null);
  const deletingIds = useRef(new Set<string>());
  const sidebarWidthRef = useRef(274);
  const tagPanelHeightRef = useRef(180);
  const pageDragRef = useRef<{
    pointerId: number;
    pageId: string;
    started: boolean;
    startX: number;
    startY: number;
    drop: PageDrop | null;
  } | null>(null);

  useEffect(() => {
    const stored = Number(localStorage.getItem("grove-sidebar-width"));
    const storedTagHeight = Number(
      localStorage.getItem("grove-tag-panel-height"),
    );
    if (Number.isFinite(stored) && stored >= 64 && stored <= 274) {
      queueMicrotask(() => {
        sidebarWidthRef.current = stored;
        setSidebarWidth(stored);
      });
    }
    if (
      Number.isFinite(storedTagHeight) &&
      storedTagHeight >= 112 &&
      storedTagHeight <= 360
    ) {
      queueMicrotask(() => {
        tagPanelHeightRef.current = storedTagHeight;
        setTagPanelHeight(storedTagHeight);
      });
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setIsNarrow(media.matches);
      if (media.matches) {
        setSidebarOpen(false);
        setAiOpen(false);
      }
    };
    queueMicrotask(() => {
      setIsNarrow(media.matches);
      if (media.matches) setSidebarOpen(false);
    });
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    return () => document.body.classList.remove("dragging-pages");
  }, []);

  useEffect(() => {
    if (cloudMode) return;
    const raw = localStorage.getItem("storytree-pages");
    const storedActiveId = localStorage.getItem("storytree-active-page");
    const storedProvider = localStorage.getItem("storytree-ai-provider");
    const storedModel = localStorage.getItem("storytree-ai-model");
    const storedTags = localStorage.getItem("storytree-tags");
    const storedPageTags = localStorage.getItem("storytree-page-tags");
    const storedRelationships = localStorage.getItem("storytree-relationships");
    queueMicrotask(() => {
      if (raw) {
        try {
          const restored = JSON.parse(raw) as Array<
            StoryPage & { pageType?: string; fields?: unknown }
          >;
          if (restored.length) {
            setPages(
              restored.map((page) => ({
                ...page,
                pageType: normalizePageType(page.pageType),
                fields: normalizePageFields(page.fields),
              })),
            );
          }
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
      if (storedTags) {
        try {
          setTags(JSON.parse(storedTags) as StoryTag[]);
        } catch {
          localStorage.removeItem("storytree-tags");
        }
      }
      if (storedPageTags) {
        try {
          setPageTags(JSON.parse(storedPageTags) as Record<string, string[]>);
        } catch {
          localStorage.removeItem("storytree-page-tags");
        }
      }
      if (storedRelationships) {
        try {
          setRelationships(JSON.parse(storedRelationships) as StoryRelationship[]);
        } catch {
          localStorage.removeItem("storytree-relationships");
        }
      }
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
              content: { html: page.content, unvisited: page.unvisited },
              page_type: page.pageType,
              fields: page.fields,
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
    if (cloudMode) return;
    localStorage.setItem("storytree-tags", JSON.stringify(tags));
    localStorage.setItem("storytree-page-tags", JSON.stringify(pageTags));
    localStorage.setItem(
      "storytree-relationships",
      JSON.stringify(relationships),
    );
  }, [cloudMode, pageTags, relationships, tags]);

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
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", openAi);
    return () => window.removeEventListener("keydown", openAi);
  }, []);

  const activePage = pages.find((page) => page.id === activeId) ?? pages[0];
  const tagTarget =
    pages.find((page) => page.id === tagTargetId) ?? null;
  const tagPickerPage =
    pages.find((page) => page.id === tagPickerTargetId) ?? null;
  const filteredPages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? pages.filter((page) => page.title.toLowerCase().includes(query))
      : pages;
  }, [pages, search]);
  const storyPages = useMemo(
    () => filteredPages.filter((page) => page.pageType !== "chapter"),
    [filteredPages],
  );
  const chapterPages = useMemo(() => {
    const chapters = pages.filter((page) => page.pageType === "chapter");
    const query = search.trim().toLowerCase();
    return query
      ? chapters.filter((page) => page.title.toLowerCase().includes(query))
      : chapters;
  }, [pages, search]);
  const activeRelations = useMemo(
    () =>
      relationships.filter(
        (item) =>
          item.fromPageId === activeId || item.toPageId === activeId,
      ),
    [activeId, relationships],
  );

  const createPage = useCallback(
    (
      parentId: string | null = null,
      title = "Untitled",
      activate = true,
      pageType: PageType = "page",
      fields: Record<string, string> = {},
    ) => {
      const page: StoryPage = {
        id: makeId(),
        parentId: pageType === "chapter" ? null : parentId,
        title,
        content: "<p></p>",
        pageType,
        fields,
        unvisited: !activate,
        updatedAt: Date.now(),
      };
      setPages((current) => [...current, page]);
      if (pageType === "chapter") setChaptersOpen(true);
      if (parentId) {
        setExpanded((current) => new Set(current).add(parentId));
      }
      if (activate) setActiveId(page.id);
      return page;
    },
    [],
  );

  const movePage = useCallback(
    (draggedId: string, drop: PageDrop) => {
      setPages((current) => {
        const next = applyPageDrop(current, draggedId, drop);
        if (!next) return current;
        return next.map((page) =>
          page.id === draggedId ? { ...page, updatedAt: Date.now() } : page,
        );
      });
      if (drop.type === "inside") {
        setExpanded((current) => new Set(current).add(drop.targetId));
      }
      const target = pages.find((page) => page.id === drop.targetId);
      const dragged = pages.find((page) => page.id === draggedId);
      if (target && dragged) {
        setNotice(
          drop.type === "inside"
            ? `Moved ${dragged.title || "Untitled"} inside ${
                target.title || "Untitled"
              }`
            : `Moved ${dragged.title || "Untitled"}`,
        );
        window.setTimeout(() => setNotice(""), 1800);
      }
    },
    [pages],
  );

  const startPageDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, pageId: string) => {
      if (search.trim() || sidebarWidth < 112) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      pageDragRef.current = {
        pointerId: event.pointerId,
        pageId,
        started: false,
        startX: event.clientX,
        startY: event.clientY,
        drop: null,
      };
    },
    [search, sidebarWidth],
  );

  const updatePageDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = pageDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.started) {
        if (
          Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
          6
        ) {
          return;
        }
        drag.started = true;
        setDraggingId(drag.pageId);
        document.body.classList.add("dragging-pages");
      }
      const node = document.elementFromPoint(event.clientX, event.clientY);
      const row = node?.closest<HTMLElement>("[data-page-id]");
      const targetId = row?.dataset.pageId;
      if (!row || !targetId || targetId === drag.pageId) {
        drag.drop = null;
        setDropTarget(null);
        return;
      }
      const rect = row.getBoundingClientRect();
      const drop: PageDrop = {
        type: dropPlacementFromOffset((event.clientY - rect.top) / rect.height),
        targetId,
      };
      const preview = applyPageDrop(pages, drag.pageId, drop);
      if (!preview) {
        drag.drop = null;
        setDropTarget(null);
        return;
      }
      drag.drop = drop;
      setDropTarget(drop);
    },
    [pages],
  );

  const finishPageDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = pageDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      pageDragRef.current = null;
      document.body.classList.remove("dragging-pages");
      const drop = drag.drop;
      const pageId = drag.pageId;
      setDraggingId(null);
      setDropTarget(null);
      if (drag.started && drop) movePage(pageId, drop);
    },
    [movePage],
  );

  const moveChapter = useCallback(
    (draggedId: string, drop: { type: "before" | "after"; targetId: string }) => {
      setPages((current) => {
        const remainingChapters = current.filter(
          (page) => page.pageType === "chapter" && page.id !== draggedId,
        );
        const targetIndex = remainingChapters.findIndex(
          (page) => page.id === drop.targetId,
        );
        const beforeId =
          drop.type === "before"
            ? drop.targetId
            : remainingChapters[targetIndex + 1]?.id ?? null;
        return reorderAmong(
          current,
          (page) => page.pageType === "chapter",
          draggedId,
          beforeId,
        ).map((page) =>
          page.id === draggedId ? { ...page, updatedAt: Date.now() } : page,
        );
      });
    },
    [],
  );

  const startChapterDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, pageId: string) => {
      if (search.trim() || sidebarWidth < 112) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      pageDragRef.current = {
        pointerId: event.pointerId,
        pageId,
        started: false,
        startX: event.clientX,
        startY: event.clientY,
        drop: null,
      };
    },
    [search, sidebarWidth],
  );

  const updateChapterDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = pageDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.started) {
        if (
          Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
          6
        ) {
          return;
        }
        drag.started = true;
        setDraggingId(drag.pageId);
        document.body.classList.add("dragging-pages");
      }
      const node = document.elementFromPoint(event.clientX, event.clientY);
      const row = node?.closest<HTMLElement>("[data-chapter-id]");
      const targetId = row?.dataset.chapterId;
      if (!row || !targetId || targetId === drag.pageId) {
        drag.drop = null;
        setDropTarget(null);
        return;
      }
      const rect = row.getBoundingClientRect();
      const drop: PageDrop = {
        type:
          (event.clientY - rect.top) / rect.height < 0.5 ? "before" : "after",
        targetId,
      };
      drag.drop = drop;
      setDropTarget(drop);
    },
    [],
  );

  const finishChapterDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = pageDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      pageDragRef.current = null;
      document.body.classList.remove("dragging-pages");
      const drop = drag.drop;
      const pageId = drag.pageId;
      setDraggingId(null);
      setDropTarget(null);
      if (drag.started && drop && drop.type !== "inside") {
        moveChapter(pageId, { type: drop.type, targetId: drop.targetId });
      }
    },
    [moveChapter],
  );

  const createLinkedPage = useCallback(
    (title: string, applyLink: (href: string) => void) => {
      const sourcePage = pages.find((page) => page.id === activeId);
      const parentId = sourcePage?.parentId ?? null;
      const existing = pages.find(
        (page) =>
          page.parentId === parentId &&
          page.title.toLowerCase() === title.toLowerCase(),
      );
      const page = existing ?? createPage(parentId, title, false);
      applyLink(`#page-${page.id}`);
      setTagTargetId(page.id);
      setNotice(existing ? `Linked to ${page.title}` : `Created ${page.title}`);
      window.setTimeout(() => setNotice(""), 2200);
      return { id: page.id, title: page.title };
    },
    [activeId, createPage, pages],
  );

  const openTagPicker = useCallback(
    (pageId: string | null) => {
      if (!pageId || !pages.some((page) => page.id === pageId)) {
        setNotice(
          "Create a page link or place the cursor beside one before using /t.",
        );
        window.setTimeout(() => setNotice(""), 2800);
        return;
      }
      setTagPickerTargetId(pageId);
    },
    [pages],
  );

  const togglePageTag = useCallback(
    async (pageId: string, tagId: string) => {
      const assigned = pageTags[pageId]?.includes(tagId) ?? false;
      setPageTags((current) => ({
        ...current,
        [pageId]: assigned
          ? (current[pageId] ?? []).filter((id) => id !== tagId)
          : [...(current[pageId] ?? []), tagId],
      }));

      if (!cloudMode) return;
      const supabase = createClient();
      const { error } = assigned
        ? await supabase
            .from("page_tags")
            .delete()
            .eq("page_id", pageId)
            .eq("tag_id", tagId)
        : await supabase
            .from("page_tags")
            .insert({ page_id: pageId, tag_id: tagId });
      if (error) {
        setPageTags((current) => ({
          ...current,
          [pageId]: assigned
            ? [...(current[pageId] ?? []), tagId]
            : (current[pageId] ?? []).filter((id) => id !== tagId),
        }));
        setNotice("That tag change could not be saved.");
        window.setTimeout(() => setNotice(""), 2200);
      }
    },
    [cloudMode, pageTags],
  );

  const createAndAssignTag = useCallback(
    async (pageId: string, requestedName: string) => {
      const name = requestedName.trim().replace(/\s+/g, " ").slice(0, 40);
      if (!name) return;
      let tag = tags.find(
        (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
      );

      if (!tag) {
        if (cloudMode && workspaceId && userId) {
          const { data, error } = await createClient()
            .from("tags")
            .insert({
              workspace_id: workspaceId,
              name,
              created_by: userId,
            })
            .select("id,name")
            .single();
          if (error || !data) {
            setNotice(
              error?.code === "23505"
                ? "That tag already exists. Reopen the picker to select it."
                : "The new tag could not be saved.",
            );
            window.setTimeout(() => setNotice(""), 2600);
            return;
          }
          tag = data;
        } else {
          tag = { id: makeId(), name };
        }
        setTags((current) =>
          [...current, tag as StoryTag].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
      }

      if (!(pageTags[pageId] ?? []).includes(tag.id)) {
        await togglePageTag(pageId, tag.id);
      }
    },
    [cloudMode, pageTags, tags, togglePageTag, userId, workspaceId],
  );

  const updatePage = useCallback(
    (
      pageId: string,
      patch: Partial<
        Pick<StoryPage, "title" | "content" | "pageType" | "fields">
      >,
    ) => {
      setPages((current) =>
        current.map((page) =>
          page.id === pageId
            ? { ...page, ...patch, updatedAt: Date.now() }
            : page,
        ),
      );
    },
    [],
  );

  const updateActivePage = useCallback(
    (
      patch: Partial<
        Pick<StoryPage, "title" | "content" | "pageType" | "fields">
      >,
    ) => {
      updatePage(activeId, patch);
    },
    [activeId, updatePage],
  );

  const changePageType = useCallback((pageId: string, pageType: PageType) => {
    setPages((current) =>
      applyPageTypeChange(current, pageId, pageType).map((page) => {
        if (page.id !== pageId) {
          return page.parentId === null
            ? { ...page, updatedAt: Date.now() }
            : page;
        }
        return {
          ...page,
          fields: isTimelinePageType(pageType)
            ? page.fields
            : withoutTimelineY(page.fields),
          updatedAt: Date.now(),
        };
      }),
    );
    if (pageType === "chapter") setChaptersOpen(true);
  }, []);

  const openRelatePicker = useCallback(
    (pageId: string | null) => {
      if (!pageId || !pages.some((page) => page.id === pageId)) {
        setNotice(
          "Create a page link or place the cursor beside one before using /r.",
        );
        window.setTimeout(() => setNotice(""), 2800);
        return;
      }
      if (pageId === activeId) {
        setRelatePicker({ fromId: pageId });
        return;
      }
      setRelatePicker({ fromId: activeId, toId: pageId });
    },
    [activeId, pages],
  );

  const createRelationship = useCallback(
    async (fromPageId: string, toPageId: string, requestedLabel: string) => {
      const label = requestedLabel.trim().replace(/\s+/g, " ").slice(0, 40);
      if (!label || fromPageId === toPageId) return;
      const duplicate = relationships.some(
        (item) =>
          item.fromPageId === fromPageId &&
          item.toPageId === toPageId &&
          item.label.toLowerCase() === label.toLowerCase(),
      );
      if (duplicate) {
        setNotice("That relationship already exists.");
        window.setTimeout(() => setNotice(""), 2200);
        return;
      }
      const relationship: StoryRelationship = {
        id: makeId(),
        fromPageId,
        toPageId,
        label,
      };
      setRelationships((current) => [...current, relationship]);
      if (cloudMode && workspaceId) {
        const { data, error } = await createClient()
          .from("page_relationships")
          .insert({
            id: relationship.id,
            workspace_id: workspaceId,
            from_page_id: fromPageId,
            to_page_id: toPageId,
            label,
          })
          .select("id")
          .single();
        if (error) {
          setRelationships((current) =>
            current.filter((item) => item.id !== relationship.id),
          );
          setNotice(
            error.code === "23505"
              ? "That relationship already exists."
              : "The relationship could not be saved.",
          );
          window.setTimeout(() => setNotice(""), 2600);
          return;
        }
        if (data?.id && data.id !== relationship.id) {
          setRelationships((current) =>
            current.map((item) =>
              item.id === relationship.id ? { ...item, id: data.id } : item,
            ),
          );
        }
      }
      setNotice("Relationship saved");
      window.setTimeout(() => setNotice(""), 1800);
    },
    [cloudMode, relationships, workspaceId],
  );

  const deleteRelationship = useCallback(
    async (id: string) => {
      setRelationships((current) => current.filter((item) => item.id !== id));
      if (!cloudMode) return;
      const { error } = await createClient()
        .from("page_relationships")
        .delete()
        .eq("id", id);
      if (error) {
        setNotice("That relationship could not be removed.");
        window.setTimeout(() => setNotice(""), 2200);
      }
    },
    [cloudMode],
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
            pageType: "page",
            fields: {},
            unvisited: false,
            updatedAt: Date.now(),
          },
        ];
      }
      setPages(remaining);
      setPageTags((current) => {
        const next = { ...current };
        deletedIds.forEach((deletedId) => delete next[deletedId]);
        return next;
      });
      setRelationships((current) =>
        current.filter(
          (item) =>
            !deletedIds.has(item.fromPageId) && !deletedIds.has(item.toPageId),
        ),
      );
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
    setSidebarOpen(false);
  }, []);

  function setDesktopSidebarWidth(width: number) {
    const next = Math.min(274, Math.max(64, width));
    sidebarWidthRef.current = next;
    setSidebarWidth(next);
  }

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (isNarrow) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidthRef.current;
    document.body.classList.add("resizing-sidebar");

    const move = (moveEvent: PointerEvent) => {
      setDesktopSidebarWidth(startWidth + moveEvent.clientX - startX);
    };
    const stop = () => {
      document.body.classList.remove("resizing-sidebar");
      localStorage.setItem(
        "grove-sidebar-width",
        String(sidebarWidthRef.current),
      );
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function setTagPanelSize(height: number) {
    const next = Math.min(360, Math.max(112, height));
    tagPanelHeightRef.current = next;
    setTagPanelHeight(next);
  }

  function startTagPanelResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = tagPanelHeightRef.current;
    document.body.classList.add("resizing-tag-panel");

    const move = (moveEvent: PointerEvent) => {
      setTagPanelSize(startHeight + startY - moveEvent.clientY);
    };
    const stop = () => {
      document.body.classList.remove("resizing-tag-panel");
      localStorage.setItem(
        "grove-tag-panel-height",
        String(tagPanelHeightRef.current),
      );
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  if (!activePage) return null;
  const sidebarMode =
    sidebarWidth < 112 ? "rail" : sidebarWidth < 190 ? "compact" : "full";
  const sidebarIndent = 3 + ((sidebarWidth - 64) / (274 - 64)) * 14;

  return (
    <main className="workspace-shell">
      {sidebarOpen && (
        <aside
          className={`sidebar sidebar-${sidebarMode}`}
          style={
            {
              width: sidebarWidth,
              flexBasis: sidebarWidth,
              "--sidebar-indent": `${sidebarIndent}px`,
            } as CSSProperties
          }
        >
          <div className="brand">
            <span className="brand-mark">
              <BookOpen size={18} />
            </span>
            <span className="brand-name">Grove</span>
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
            {draggingId && dropTarget && (
              <div className="page-drop-hint" role="status">
                {dropTarget.type === "inside"
                  ? `Drop inside ${
                      pages.find((page) => page.id === dropTarget.targetId)
                        ?.title || "page"
                    }`
                  : dropTarget.type === "before"
                    ? `Drop before ${
                        pages.find((page) => page.id === dropTarget.targetId)
                          ?.title || "page"
                      }`
                    : `Drop after ${
                        pages.find((page) => page.id === dropTarget.targetId)
                          ?.title || "page"
                      }`}
              </div>
            )}
            <PageBranch
              pages={storyPages}
              allPages={storyPages}
              parentId={null}
              activeId={activeId}
              expanded={expanded}
              draggingId={draggingId}
              dropTarget={dropTarget}
              canDrag={!search.trim() && sidebarMode !== "rail"}
              onSelect={(id) => {
                setActiveId(id);
                setTagTargetId(null);
                setTagPickerTargetId(null);
                setPages((current) =>
                  current.map((page) =>
                    page.id === id && page.unvisited
                      ? { ...page, unvisited: false }
                      : page,
                  ),
                );
                if (isNarrow) setSidebarOpen(false);
              }}
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
              onDragStart={startPageDrag}
              onDragMove={updatePageDrag}
              onDragEnd={finishPageDrag}
            />
          </nav>

          <section
            className={`sidebar-chapters ${chaptersOpen ? "open" : "collapsed"}`}
          >
            <div className="chapter-section-heading">
              <button
                type="button"
                className="tag-section-heading"
                aria-expanded={chaptersOpen}
                onClick={() => setChaptersOpen((current) => !current)}
              >
                {chaptersOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <BookOpen size={14} />
                <span>Chapters</span>
                <small>{chapterPages.length}</small>
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Create chapter"
                title="Create chapter"
                onClick={() => createPage(null, "Untitled", true, "chapter")}
              >
                <Plus size={15} />
              </button>
              <button
                type="button"
                className="icon-button chapter-export"
                aria-label="Export manuscript"
                title="Print chapters as PDF"
                onClick={() => setExportOpen(true)}
              >
                <Printer size={15} />
              </button>
            </div>
            {chaptersOpen && (
              <nav className="sidebar-chapter-list" aria-label="Chapters">
                {chapterPages.length === 0 ? (
                  <p className="sidebar-empty-hint">
                    Set a page type to Chapter, or add one here.
                  </p>
                ) : (
                  chapterPages.map((page) => (
                    <div
                      key={page.id}
                      data-chapter-id={page.id}
                      className={`page-row ${
                        activeId === page.id ? "active" : ""
                      } ${page.unvisited ? "unvisited" : ""} ${
                        draggingId === page.id ? "dragging" : ""
                      } ${
                        dropTarget?.targetId === page.id
                          ? `drop-${dropTarget.type}`
                          : ""
                      }`}
                    >
                      {sidebarMode !== "rail" && !search.trim() && (
                        <button
                          type="button"
                          className="page-drag-handle"
                          aria-label={`Reorder ${page.title || "Untitled"}`}
                          title="Drag to set export order"
                          onPointerDown={(event) =>
                            startChapterDrag(event, page.id)
                          }
                          onPointerMove={updateChapterDrag}
                          onPointerUp={finishChapterDrag}
                          onPointerCancel={finishChapterDrag}
                          onLostPointerCapture={finishChapterDrag}
                        >
                          <GripVertical size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="page-name"
                        data-initial={(page.title || "Untitled")
                          .charAt(0)
                          .toUpperCase()}
                        title={page.title || "Untitled"}
                        onClick={() => {
                          setActiveId(page.id);
                          setTagTargetId(null);
                          setTagPickerTargetId(null);
                          setPages((current) =>
                            current.map((candidate) =>
                              candidate.id === page.id && candidate.unvisited
                                ? { ...candidate, unvisited: false }
                                : candidate,
                            ),
                          );
                          if (isNarrow) setSidebarOpen(false);
                        }}
                      >
                        <BookOpen size={15} />
                        {page.unvisited && (
                          <span
                            className="unvisited-page-dot"
                            title="New page"
                          />
                        )}
                        <span>{page.title || "Untitled"}</span>
                      </button>
                      <button
                        type="button"
                        className="row-delete"
                        aria-label={`Delete ${page.title}`}
                        title="Delete chapter"
                        onClick={() => deletePage(page.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </nav>
            )}
          </section>

          {tagsOpen && (
            <div
              className="tag-panel-resizer"
              role="separator"
              aria-label="Resize pages and tags lists"
              aria-orientation="horizontal"
              aria-valuemin={112}
              aria-valuemax={360}
              aria-valuenow={tagPanelHeight}
              tabIndex={0}
              onPointerDown={startTagPanelResize}
              onDoubleClick={() => {
                setTagPanelSize(180);
                localStorage.setItem("grove-tag-panel-height", "180");
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setTagPanelSize(tagPanelHeight + 16);
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setTagPanelSize(tagPanelHeight - 16);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setTagPanelSize(112);
                } else if (event.key === "End") {
                  event.preventDefault();
                  setTagPanelSize(360);
                } else {
                  return;
                }
                localStorage.setItem(
                  "grove-tag-panel-height",
                  String(tagPanelHeightRef.current),
                );
              }}
            />
          )}
          <section
            className={`sidebar-tags ${tagsOpen ? "open" : "collapsed"}`}
            style={tagsOpen ? { height: tagPanelHeight } : undefined}
          >
            <button
              type="button"
              className="tag-section-heading"
              aria-expanded={tagsOpen}
              onClick={() => setTagsOpen((current) => !current)}
            >
              {tagsOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <Tag size={14} />
              <span>Tags</span>
              <small>{tags.length}</small>
            </button>
            {tagsOpen && (
              <div className="sidebar-tag-list" aria-label="Project tags">
                {tags.map((tag) => {
                  const usageCount = Object.values(pageTags).filter(
                    (assignedTags) => assignedTags.includes(tag.id),
                  ).length;
                  const taggedPages = pages.filter((page) =>
                    (pageTags[page.id] ?? []).includes(tag.id),
                  );
                  const tagExpanded = expandedTagId === tag.id;
                  return (
                    <div className="sidebar-tag-group" key={tag.id}>
                      <button
                        type="button"
                        className={`sidebar-tag-row ${
                          tagExpanded ? "active" : ""
                        }`}
                        aria-expanded={tagExpanded}
                        onClick={() =>
                          setExpandedTagId((current) =>
                            current === tag.id ? null : tag.id,
                          )
                        }
                      >
                        {tagExpanded ? (
                          <ChevronDown size={12} />
                        ) : (
                          <ChevronRight size={12} />
                        )}
                        <span>{tag.name}</span>
                        <small>{usageCount}</small>
                      </button>
                      {tagExpanded && (
                        <div
                          className="sidebar-tag-pages"
                          aria-label={`Pages tagged ${tag.name}`}
                        >
                          {taggedPages.map((page) => (
                            <button
                              type="button"
                              key={page.id}
                              className={page.id === activeId ? "active" : ""}
                              onClick={() => {
                                setActiveId(page.id);
                                setTagTargetId(null);
                                setTagPickerTargetId(null);
                                setPages((current) =>
                                  current.map((candidate) =>
                                    candidate.id === page.id &&
                                    candidate.unvisited
                                      ? { ...candidate, unvisited: false }
                                      : candidate,
                                  ),
                                );
                                if (isNarrow) setSidebarOpen(false);
                              }}
                            >
                              <FileText size={12} />
                              <span>{page.title || "Untitled"}</span>
                            </button>
                          ))}
                          {taggedPages.length === 0 && <p>No pages yet.</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {tags.length === 0 && (
                  <p>Create a page tag to see it here.</p>
                )}
              </div>
            )}
          </section>

          <div className="sidebar-footer">
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
                if (isNarrow) setSidebarOpen(false);
              }}
            >
              <Settings size={16} />
              <span>Settings</span>
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
          <div
            className="sidebar-resizer"
            role="separator"
            aria-label="Resize page sidebar"
            aria-orientation="vertical"
            aria-valuemin={64}
            aria-valuemax={274}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            onPointerDown={startSidebarResize}
            onDoubleClick={() => {
              setDesktopSidebarWidth(274);
              localStorage.setItem("grove-sidebar-width", "274");
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setDesktopSidebarWidth(sidebarWidth - 12);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setDesktopSidebarWidth(sidebarWidth + 12);
              } else if (event.key === "Home") {
                event.preventDefault();
                setDesktopSidebarWidth(64);
              } else if (event.key === "End") {
                event.preventDefault();
                setDesktopSidebarWidth(274);
              } else {
                return;
              }
              localStorage.setItem(
                "grove-sidebar-width",
                String(sidebarWidthRef.current),
              );
            }}
          />
        </aside>
      )}

      {isNarrow && (sidebarOpen || aiOpen) && (
        <button
          type="button"
          className="workspace-backdrop"
          aria-label="Close open panel"
          onClick={() => {
            setSidebarOpen(false);
            setAiOpen(false);
          }}
        />
      )}

      <section className="document-pane">
        <header className="topbar">
          <div className="breadcrumbs">
            {!sidebarOpen && (
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setSidebarOpen(true);
                  setAiOpen(false);
                }}
                aria-label="Open sidebar"
              >
                <Menu size={19} />
              </button>
            )}
            <button
              type="button"
              className="dashboard-return"
              onClick={() => router.push("/")}
            >
              <ArrowLeft size={14} />
              <span>Projects</span>
            </button>
            <ChevronRight size={14} />
            <span className="workspace-name">{workspaceName}</span>
            <ChevronRight size={14} className="desktop-crumb" />
            <strong>{activePage.title}</strong>
            {researchOpen && (
              <>
                <ChevronRight size={14} />
                <strong>Research</strong>
              </>
            )}
            {relationshipsOpen && (
              <>
                <ChevronRight size={14} />
                <strong>Relationships</strong>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {!researchOpen && !relationshipsOpen && (
              <span className="save-state">
                {savedAt ? "Saved" : "Saving…"}
              </span>
            )}
            {!relationshipsOpen && (
              <button
                type="button"
                className={`research-button ${researchOpen ? "active" : ""}`}
                onClick={() => {
                  setResearchOpen((current) => !current);
                  setRelationshipsOpen(false);
                  setAiOpen(false);
                  setSidebarOpen(false);
                }}
              >
                <LibraryBig size={15} />
                <span>{researchOpen ? "Writing" : "Research"}</span>
              </button>
            )}
            {!researchOpen && (
              <button
                type="button"
                className={`research-button ${relationshipsOpen ? "active" : ""}`}
                onClick={() => {
                  setRelationshipsOpen((current) => !current);
                  setResearchOpen(false);
                  setAiOpen(false);
                  setSidebarOpen(false);
                }}
              >
                <GitFork size={15} />
                <span>{relationshipsOpen ? "Writing" : "Relationships"}</span>
              </button>
            )}
            {!researchOpen && !relationshipsOpen && (
              <button
                type="button"
                className="ai-button"
                onClick={() => openAi()}
              >
                <Sparkles size={15} />
                <span>Ask AI</span>
                <kbd>Alt A</kbd>
              </button>
            )}
            <button
              type="button"
              className="help-button"
              title="Page help"
              aria-label="Page help"
              onClick={() => setHelpOpen(true)}
            >
              <CircleHelp size={17} />
            </button>
          </div>
        </header>

        {researchOpen ? (
          <ResearchView
            key={activePage.id}
            pageId={activePage.id}
            pageTitle={activePage.title}
            cloudMode={cloudMode}
            userId={userId}
            onClose={() => setResearchOpen(false)}
          />
        ) : relationshipsOpen ? (
          <RelationshipsView
            pages={pages}
            relationships={relationships}
            workspaceId={workspaceId}
            onOpenPage={(id) => {
              setActiveId(id);
              setRelationshipsOpen(false);
              setTagTargetId(null);
              setTagPickerTargetId(null);
              setPages((current) =>
                current.map((page) =>
                  page.id === id && page.unvisited
                    ? { ...page, unvisited: false }
                    : page,
                ),
              );
            }}
            onClose={() => setRelationshipsOpen(false)}
            onCreateEvent={(y, lane) => {
              const page = createPage(null, "Untitled", false, "event", {
                timelineY: serializeTimelineY(y),
                timelineLane: serializeTimelineLane(lane),
              });
              return page.id;
            }}
            onUpdatePage={updatePage}
          />
        ) : (
          <article className="document">
            <div className="document-meta">
              <span>{PAGE_TYPE_LABELS[activePage.pageType].toUpperCase()}</span>
              <span>•</span>
              <span>Edited just now</span>
            </div>
            <label className="page-type-picker">
              <span>Type</span>
              <select
                value={activePage.pageType}
                aria-label="Page type"
                onChange={(event) =>
                  changePageType(activePage.id, event.target.value as PageType)
                }
              >
                {PAGE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PAGE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            {PAGE_TYPE_FIELDS[activePage.pageType].length > 0 && (
              <div className="page-type-fields">
                {PAGE_TYPE_FIELDS[activePage.pageType].map((field) => (
                  <label
                    key={field.key}
                    className={field.key === "aka" ? "aka-field" : undefined}
                  >
                    <span>{field.label}</span>
                    <input
                      value={activePage.fields[field.key] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        updateActivePage({
                          fields: {
                            ...activePage.fields,
                            [field.key]: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            <div
              className="document-title-row"
              onClick={() => setTagTargetId(activePage.id)}
            >
              <textarea
                className="document-title"
                rows={1}
                value={activePage.title}
                onChange={(event) =>
                  updateActivePage({
                    title: event.target.value.replace(/\s*\n+\s*/g, " "),
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                aria-label="Page title"
              />
            </div>
            {(pageTags[activePage.id] ?? []).length > 0 && (
              <div className="page-tag-list" aria-label="Page tags">
                {(pageTags[activePage.id] ?? []).map((tagId) => {
                  const tag = tags.find((candidate) => candidate.id === tagId);
                  return tag ? (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={() => {
                        setTagTargetId(activePage.id);
                        setTagPickerTargetId(activePage.id);
                      }}
                    >
                      {tag.name}
                    </button>
                  ) : null;
                })}
              </div>
            )}
            {activeRelations.length > 0 && (
              <div className="related-chip-list" aria-label="Related pages">
                {activeRelations.map((item) => {
                  const otherId =
                    item.fromPageId === activePage.id
                      ? item.toPageId
                      : item.fromPageId;
                  const other = pages.find((page) => page.id === otherId);
                  const outgoing = item.fromPageId === activePage.id;
                  return (
                    <span key={item.id} className="related-chip">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveId(otherId);
                          setTagTargetId(null);
                          setTagPickerTargetId(null);
                        }}
                      >
                        {outgoing
                          ? `${item.label} → ${other?.title || "Untitled"}`
                          : `${other?.title || "Untitled"} → ${item.label}`}
                      </button>
                      <button
                        type="button"
                        className="related-chip-remove"
                        aria-label="Remove relationship"
                        onClick={() => void deleteRelationship(item.id)}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <StoryEditor
              key={activePage.id}
              content={activePage.content}
              onChange={(content) => updateActivePage({ content })}
              onCreatePage={createLinkedPage}
              onOpenAi={openAi}
              tagTarget={
                tagTarget
                  ? { id: tagTarget.id, title: tagTarget.title }
                  : null
              }
              onTagTargetChange={setTagTargetId}
              onOpenTags={openTagPicker}
              onOpenRelate={openRelatePicker}
              linkablePages={pages.map((page) => ({
                id: page.id,
                title: page.title,
                aliases: pageTypeHasAka(page.pageType)
                  ? parseAkaNames(page.fields.aka)
                  : undefined,
              }))}
              currentPageId={activePage.id}
              onFindLinks={(count) => {
                setNotice(
                  count
                    ? `Linked ${count} ${count === 1 ? "name" : "names"}`
                    : "No matching page names on this page.",
                );
                window.setTimeout(() => setNotice(""), 2200);
              }}
              onNavigatePage={(id) => {
                if (!pages.some((page) => page.id === id)) return;
                setActiveId(id);
                setTagTargetId(null);
                setTagPickerTargetId(null);
                setPages((current) =>
                  current.map((page) =>
                    page.id === id && page.unvisited
                      ? { ...page, unvisited: false }
                      : page,
                  ),
                );
              }}
            />
          </article>
        )}
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
          onSetPassword={
            cloudMode
              ? async (password) => {
                  const { error } = await createClient().auth.updateUser({
                    password,
                  });
                  setNotice(
                    error
                      ? error.message
                      : "Password saved. You can use it next time you sign in.",
                  );
                  window.setTimeout(() => setNotice(""), 3200);
                  return !error;
                }
              : undefined
          }
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

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}

      {tagPickerPage && (
        <TagPicker
          page={tagPickerPage}
          tags={tags}
          selectedTagIds={pageTags[tagPickerPage.id] ?? []}
          onToggle={(tagId) => void togglePageTag(tagPickerPage.id, tagId)}
          onCreate={(name) =>
            void createAndAssignTag(tagPickerPage.id, name)
          }
          onClose={() => setTagPickerTargetId(null)}
        />
      )}

      {relatePicker && pages.some((page) => page.id === relatePicker.fromId) && (
        <RelatePicker
          fromPage={pages.find((page) => page.id === relatePicker.fromId)!}
          toPage={
            relatePicker.toId
              ? (pages.find((page) => page.id === relatePicker.toId) ?? null)
              : null
          }
          pages={pages}
          onCreate={(fromId, toId, label) => {
            void createRelationship(fromId, toId, label);
            setRelatePicker(null);
          }}
          onClose={() => setRelatePicker(null)}
        />
      )}

      {exportOpen && (
        <ManuscriptPreview
          projectTitle={workspaceName}
          chapters={pages
            .filter((page) => page.pageType === "chapter")
            .map((page) => ({
              id: page.id,
              title: page.title,
              content: page.content,
            }))}
          onClose={() => setExportOpen(false)}
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
  draggingId: string | null;
  dropTarget: PageDrop | null;
  canDrag: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAdd: (parentId: string, title?: string, activate?: boolean) => StoryPage;
  onDelete: (id: string) => void;
  onDragStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    pageId: string,
  ) => void;
  onDragMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

function PageBranch({
  pages,
  allPages,
  parentId,
  activeId,
  expanded,
  draggingId,
  dropTarget,
  canDrag,
  onSelect,
  onToggle,
  onAdd,
  onDelete,
  onDragStart,
  onDragMove,
  onDragEnd,
}: PageBranchProps) {
  return pages
    .filter((page) => page.parentId === parentId)
    .map((page) => {
      const hasChildren = allPages.some((child) => child.parentId === page.id);
      return (
        <div key={page.id}>
          <div
            data-page-id={page.id}
            className={`page-row ${activeId === page.id ? "active" : ""} ${
              page.unvisited ? "unvisited" : ""
            } ${draggingId === page.id ? "dragging" : ""} ${
              dropTarget?.targetId === page.id ? `drop-${dropTarget.type}` : ""
            }`}
          >
            {canDrag && (
              <button
                type="button"
                className="page-drag-handle"
                aria-label={`Reorder ${page.title || "Untitled"}`}
                title="Drag to reorder or nest"
                onPointerDown={(event) => onDragStart(event, page.id)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                onLostPointerCapture={onDragEnd}
              >
                <GripVertical size={13} />
              </button>
            )}
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
              data-initial={(page.title || "Untitled").charAt(0).toUpperCase()}
              title={page.title || "Untitled"}
              onClick={() => onSelect(page.id)}
            >
              <FileText size={15} />
              {page.unvisited && (
                <span className="unvisited-page-dot" title="New page" />
              )}
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
                draggingId={draggingId}
                dropTarget={dropTarget}
                canDrag={canDrag}
                onSelect={onSelect}
                onToggle={onToggle}
                onAdd={onAdd}
                onDelete={onDelete}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
              />
            </div>
          )}
        </div>
      );
    });
}

function TagPicker({
  page,
  tags,
  selectedTagIds,
  onToggle,
  onCreate,
  onClose,
}: {
  page: StoryPage;
  tags: StoryTag[];
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const cleanQuery = query.trim().replace(/\s+/g, " ");
  const exactTag = tags.find(
    (tag) => tag.name.toLowerCase() === cleanQuery.toLowerCase(),
  );
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(cleanQuery.toLowerCase()),
  );

  return (
    <div className="dialog-backdrop tag-dialog-backdrop" role="presentation">
      <section
        className="tag-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-picker-title"
      >
        <header>
          <div>
            <span className="eyebrow">TAGGING PAGE</span>
            <h2 id="tag-picker-title">{page.title || "Untitled"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close tag picker"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!cleanQuery) return;
            if (exactTag) {
              if (!selectedTagIds.includes(exactTag.id)) {
                onToggle(exactTag.id);
              }
            } else {
              onCreate(cleanQuery);
            }
            setQuery("");
          }}
        >
          <Tag size={15} />
          <input
            autoFocus
            value={query}
            maxLength={40}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find or create a tag…"
            aria-label="Find or create a tag"
          />
        </form>
        <div className="tag-picker-options">
          {filteredTags.map((tag) => {
            const selected = selectedTagIds.includes(tag.id);
            return (
              <button
                type="button"
                key={tag.id}
                className={selected ? "selected" : ""}
                onClick={() => onToggle(tag.id)}
              >
                <span className="tag-option-mark">
                  {selected ? <Check size={13} /> : <Tag size={12} />}
                </span>
                <span>{tag.name}</span>
              </button>
            );
          })}
          {cleanQuery && !exactTag && (
            <button
              type="button"
              className="create-tag-option"
              onClick={() => {
                onCreate(cleanQuery);
                setQuery("");
              }}
            >
              <span className="tag-option-mark">
                <Plus size={13} />
              </span>
              <span>Create “{cleanQuery}”</span>
            </button>
          )}
          {!cleanQuery && tags.length === 0 && (
            <p>No tags yet. Type a name to create the first one.</p>
          )}
        </div>
        <footer>
          <span>Project tags are available on every page.</span>
          <kbd>Enter</kbd>
        </footer>
      </section>
    </div>
  );
}

function RelatePicker({
  fromPage,
  toPage,
  pages,
  onCreate,
  onClose,
}: {
  fromPage: StoryPage;
  toPage: StoryPage | null;
  pages: StoryPage[];
  onCreate: (fromId: string, toId: string, label: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("");
  const [selectedId, setSelectedId] = useState(toPage?.id ?? "");
  const selectedPage =
    pages.find((page) => page.id === selectedId) ?? toPage;
  const candidates = pages.filter((page) => {
    if (page.id === fromPage.id) return false;
    const haystack = `${page.title} ${PAGE_TYPE_LABELS[page.pageType]}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  function submit() {
    const cleanLabel = label.trim();
    if (!selectedPage || !cleanLabel) return;
    onCreate(fromPage.id, selectedPage.id, cleanLabel);
  }

  return (
    <div className="dialog-backdrop tag-dialog-backdrop" role="presentation">
      <section
        className="tag-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="relate-picker-title"
      >
        <header>
          <div>
            <span className="eyebrow">RELATING FROM</span>
            <h2 id="relate-picker-title">{fromPage.title || "Untitled"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close relate picker"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        {toPage ? (
          <p className="relate-target-copy">
            To {toPage.title || "Untitled"}
          </p>
        ) : (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (candidates[0]) setSelectedId(candidates[0].id);
              }}
            >
              <Search size={15} />
              <input
                autoFocus={!toPage}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a page to relate…"
                aria-label="Find a page to relate"
              />
            </form>
            <div className="tag-picker-options">
              {candidates.map((page) => (
                <button
                  type="button"
                  key={page.id}
                  className={selectedId === page.id ? "selected" : ""}
                  onClick={() => setSelectedId(page.id)}
                >
                  <span className="tag-option-mark">
                    {selectedId === page.id ? (
                      <Check size={13} />
                    ) : (
                      <FileText size={12} />
                    )}
                  </span>
                  <span>
                    {page.title || "Untitled"}
                    <small className="relate-page-type">
                      {PAGE_TYPE_LABELS[page.pageType]}
                    </small>
                  </span>
                </button>
              ))}
              {candidates.length === 0 && (
                <p>No other pages match that search.</p>
              )}
            </div>
          </>
        )}
        <form
          className="relate-label-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <GitFork size={15} />
          <input
            autoFocus={Boolean(toPage)}
            value={label}
            maxLength={40}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Relationship label, e.g. lives in"
            aria-label="Relationship label"
          />
        </form>
        <div className="relate-suggestions">
          {RELATIONSHIP_SUGGESTIONS.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => setLabel(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <footer>
          <span>Prose links stay mentions; this creates a named relationship.</span>
          <button
            type="button"
            className="relate-save"
            disabled={!selectedPage || !label.trim()}
            onClick={submit}
          >
            Save
          </button>
        </footer>
      </section>
    </div>
  );
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
            <strong>Grove AI</strong>
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
  onSetPassword,
  onClose,
  onSave,
}: {
  provider: AiProvider;
  model: string;
  apiKey: string;
  secureStorage: boolean;
  onSetPassword?: (password: string) => Promise<boolean>;
  onClose: () => void;
  onSave: (provider: AiProvider, model: string, apiKey: string) => void;
}) {
  const [nextProvider, setNextProvider] = useState(provider);
  const [nextModel, setNextModel] = useState(model);
  const [nextKey, setNextKey] = useState(apiKey);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
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
            <h2 id="settings-title">Settings</h2>
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
          {onSetPassword && (
            <section className="settings-section">
              <div>
                <h3>Account password</h3>
                <p>
                  Set a password now so you can sign in without an email link.
                </p>
              </div>
              <label>
                New password
                <input
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </label>
              <button
                type="button"
                className="inline-save-button"
                disabled={newPassword.length < 8 || savingPassword}
                onClick={async () => {
                  setSavingPassword(true);
                  const saved = await onSetPassword(newPassword);
                  setSavingPassword(false);
                  if (saved) setNewPassword("");
                }}
              >
                {savingPassword ? "Saving…" : "Set password"}
              </button>
            </section>
          )}
          <section className="settings-section">
            <div>
              <h3>AI connection</h3>
              <p>Use your preferred provider and model inside Grove.</p>
            </div>
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
          </section>
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
