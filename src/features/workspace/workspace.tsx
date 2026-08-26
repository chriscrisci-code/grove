"use client";

import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Clock3,
  FileText,
  GitFork,
  GripVertical,
  LibraryBig,
  ListFilter,
  ListIndentDecrease,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  Plus,
  Printer,
  Search,
  Settings,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
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
import { ScriptEditor } from "@/features/editor/script-editor";
import {
  htmlToScriptHtml,
  mergeScriptHtml,
  proseToScriptHtml,
} from "@/features/editor/script-format";
import { RelationshipsView } from "@/features/relationships/relationships-view";
import {
  canonicalFamilyPair,
  validateFamilyRelationship,
} from "@/features/relationships/family";
import {
  emptyGeographyDocument,
  normalizeGeographyDocument,
  type GeographyDocument,
} from "@/features/relationships/geography";
import {
  isTimelinePageType,
  serializeTimelineLane,
  serializeTimelineY,
  withoutTimelineY,
} from "@/features/relationships/timeline";
import { ResearchView } from "@/features/research/research-view";
import { ReviewPanel } from "@/features/collaboration/review-panel";
import { ShareDialog } from "@/features/collaboration/share-dialog";
import { applyQuotedSuggestion } from "@/features/collaboration/collaboration";
import { ManuscriptPreview } from "@/features/workspace/manuscript-preview";
import { HelpDialog } from "@/features/workspace/help-dialog";
import { NightToggle } from "@/features/workspace/night-toggle";
import { CHANGELOG } from "@/features/workspace/changelog";
import {
  canCreatePage,
  canUseFeature,
  getPlanAccess,
  planLimitMessage,
  type FeatureName,
  type PlanAccess,
} from "@/features/billing/plan";
import {
  chapterEventChildren,
  expandChapterEventMarkers,
  insertChapterEventMarker,
  isChapterNestedEvent,
  removeChapterEventMarker,
  syncChapterEventMarkers,
} from "@/features/editor/chapter-events";
import {
  expandScriptEventMarkers,
  insertScriptEventMarker,
  isScriptNestedEvent,
  removeScriptEventMarker,
  scriptEventChildren,
  syncScriptEventMarkers,
} from "@/features/editor/script-events";
import { createClient } from "@/lib/supabase/client";
import { CacheWorkspaceBridge } from "@/features/write/register-write-sw";
import {
  putCachedWorkspace,
  workspaceCacheSnapshot,
} from "@/features/write/offline-store";
import { syncCachedWorkspacePages } from "@/features/write/offline-sync";
import {
  RESEARCH_IMAGES_BUCKET,
  researchImagePathsForPages,
} from "@/features/research/research-images";
import {
  applyPageDrop,
  applyPageTypeChange,
  dropPlacementFromOffset,
  dropTargetId,
  filterStoryPages,
  reorderAmong,
  siblingPages,
  type PageDrop,
} from "@/features/workspace/page-tree";
import {
  PAGE_TYPE_FIELDS,
  PAGE_TYPE_LABELS,
  PAGE_TYPES,
  STORY_PAGE_TYPES,
  isSidebarListType,
  FAMILY_RELATIONSHIP_LABELS,
  RELATIONSHIP_SUGGESTIONS,
  normalizePageFields,
  normalizePageType,
  pageTypeHasAka,
  parseAkaNames,
  type FamilyRelationshipKind,
  type PageType,
  type StoryRelationship,
} from "@/features/workspace/page-types";
import {
  DEFAULT_TAG_COLOR,
  TAG_COLOR_PALETTE,
  filterTags,
  normalizeTagColor,
  normalizeTagName,
} from "@/features/workspace/tags";

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
  color: string;
};

function tagColorStyle(color: string) {
  return { "--tag-color": normalizeTagColor(color) } as CSSProperties;
}

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
    fields: {},
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

function isOwnEditLock(holderEmail?: string, userEmail?: string) {
  if (!holderEmail || !userEmail) return false;
  return holderEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
}

function editLockMessage(holderEmail?: string, userEmail?: string) {
  if (isOwnEditLock(holderEmail, userEmail)) {
    return "This story is already open in another Grove window.";
  }
  return `${holderEmail || "Another collaborator"} is editing this story. You can read and review until they leave.`;
}

type WorkspaceProps = {
  initialCloudPages?: StoryPage[];
  initialTags?: StoryTag[];
  initialPageTags?: Record<string, string[]>;
  initialRelationships?: StoryRelationship[];
  initialGeography?: GeographyDocument;
  initialGeographyBackgroundUrl?: string | null;
  workspaceId?: string;
  workspaceName?: string;
  userId?: string;
  userEmail?: string;
  readOnly?: boolean;
  workspaceRole?: "owner" | "editor" | "viewer";
  planAccess?: PlanAccess;
  writeShell?: boolean;
  writeShellOnline?: boolean;
};

export function Workspace({
  initialCloudPages,
  initialTags = [],
  initialPageTags = {},
  initialRelationships = [],
  initialGeography,
  initialGeographyBackgroundUrl = null,
  workspaceId,
  workspaceName = "My Story",
  userId,
  userEmail,
  readOnly: serverReadOnly = false,
  workspaceRole,
  planAccess: serverPlanAccess,
  writeShell = false,
  writeShellOnline = true,
}: WorkspaceProps = {}) {
  const router = useRouter();
  const cloudMode = Boolean(workspaceId && userId);
  const planAccess =
    serverPlanAccess ?? getPlanAccess({ unlockPaid: !cloudMode || writeShell });
  const shouldClaimEditLease =
    cloudMode &&
    !writeShell &&
    !serverReadOnly &&
    (workspaceRole === "owner" || workspaceRole === "editor");
  const [editLease, setEditLease] = useState<{
    status: "not-needed" | "checking" | "acquired" | "blocked";
    holderEmail?: string;
  }>({
    status: shouldClaimEditLease ? "checking" : "not-needed",
  });
  const readOnly =
    serverReadOnly ||
    editLease.status === "checking" ||
    editLease.status === "blocked";
  const startingPages =
    initialCloudPages?.length ? initialCloudPages : initialPages;
  const [pages, setPages] = useState(startingPages);
  const [tags, setTags] = useState(initialTags);
  const [pageTags, setPageTags] =
    useState<Record<string, string[]>>(initialPageTags);
  const [relationships, setRelationships] = useState(initialRelationships);
  const [geography, setGeography] = useState<GeographyDocument>(() =>
    normalizeGeographyDocument(initialGeography ?? emptyGeographyDocument()),
  );
  const [geographyBackgroundUrl, setGeographyBackgroundUrl] = useState<
    string | null
  >(initialGeographyBackgroundUrl);
  const [tagTargetId, setTagTargetId] = useState<string | null>(null);
  const [tagPickerTargetId, setTagPickerTargetId] = useState<string | null>(
    null,
  );
  const [relatePicker, setRelatePicker] = useState<{
    fromId: string;
    toId?: string;
  } | null>(null);
  const [chaptersOpen, setChaptersOpen] = useState(true);
  const [scriptsOpen, setScriptsOpen] = useState(true);
  const [exportKind, setExportKind] = useState<"chapter" | "script" | null>(
    null,
  );
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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [importChapterOpen, setImportChapterOpen] = useState(false);
  const [selection, setSelection] = useState("");
  const [reviewSelection, setReviewSelection] = useState({
    pageId: "",
    text: "",
  });
  const [editorNonce, setEditorNonce] = useState(0);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [storyTypeFilter, setStoryTypeFilter] = useState<PageType[]>([]);
  const [storyFilterOpen, setStoryFilterOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState("gpt-5-mini");
  const [apiKey, setApiKey] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<PageDrop | null>(null);
  const isOwner = workspaceRole === "owner";
  const canComment = cloudMode && Boolean(workspaceRole);
  const canResolveComments =
    workspaceRole === "owner" || workspaceRole === "editor";
  const deletingIds = useRef(new Set<string>());
  const editLeaseTokenRef = useRef<string | null>(null);
  const sidebarWidthRef = useRef(274);
  const tagPanelHeightRef = useRef(180);
  const pageDragRef = useRef<{
    pointerId: number;
    pageId: string;
    started: boolean;
    startX: number;
    startY: number;
    drop: PageDrop | null;
    list?: "chapter" | "script";
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
    const storedGeography = localStorage.getItem("storytree-geography");
    const storedGeographyBackground = localStorage.getItem(
      "storytree-geography-background",
    );
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
          const restored = JSON.parse(storedTags) as Array<
            Omit<StoryTag, "color"> & { color?: unknown }
          >;
          setTags(
            restored.map((tag) => ({
              ...tag,
              color: normalizeTagColor(tag.color),
            })),
          );
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
      if (storedGeography) {
        try {
          setGeography(normalizeGeographyDocument(JSON.parse(storedGeography)));
        } catch {
          localStorage.removeItem("storytree-geography");
        }
      }
      if (storedGeographyBackground) {
        setGeographyBackgroundUrl(storedGeographyBackground);
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
    if (!shouldClaimEditLease || !workspaceId) return;
    const leaseToken = crypto.randomUUID();
    editLeaseTokenRef.current = leaseToken;
    const supabase = createClient();
    let active = true;
    let renewalTimer: number | null = null;
    let retryTimer: number | null = null;

    async function claimLease() {
      const { data, error } = await supabase.rpc(
        "claim_workspace_edit_lease",
        {
          p_workspace_id: workspaceId,
          p_lease_token: leaseToken,
        },
      );
      if (!active) return;
      const result = data as {
        acquired?: boolean;
        holderEmail?: string;
        leaseToken?: string;
      } | null;
      if (error || !result?.acquired) {
        setEditLease({
          status: "blocked",
          holderEmail:
            result?.holderEmail ||
            (error ? "Editing is temporarily unavailable" : undefined),
        });
        retryTimer = window.setTimeout(() => void claimLease(), 10_000);
        return;
      }

      if (result.leaseToken) {
        editLeaseTokenRef.current = result.leaseToken;
      }
      setEditLease({ status: "acquired" });
      renewalTimer = window.setInterval(async () => {
        const heldToken = editLeaseTokenRef.current ?? leaseToken;
        const { data: renewed, error: renewError } = await supabase.rpc(
          "renew_workspace_edit_lease",
          {
            p_workspace_id: workspaceId,
            p_lease_token: heldToken,
          },
        );
        if (active && (renewError || renewed !== true)) {
          setEditLease({ status: "blocked" });
          if (renewalTimer !== null) {
            window.clearInterval(renewalTimer);
            renewalTimer = null;
          }
          retryTimer = window.setTimeout(() => void claimLease(), 10_000);
        }
      }, 30_000);
    }

    void claimLease();
    return () => {
      active = false;
      const ownsLease = editLeaseTokenRef.current === leaseToken;
      if (ownsLease) editLeaseTokenRef.current = null;
      if (renewalTimer !== null) window.clearInterval(renewalTimer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (ownsLease) {
        void supabase.rpc("release_workspace_edit_lease", {
          p_workspace_id: workspaceId,
          p_lease_token: leaseToken,
        });
      }
    };
  }, [shouldClaimEditLease, workspaceId]);

  useEffect(() => {
    if (readOnly) return;
    const timer = window.setTimeout(async () => {
      const livePages = pages.filter((page) => !deletingIds.current.has(page.id));
      if (writeShell && workspaceId && userId) {
        await putCachedWorkspace(
          workspaceCacheSnapshot({
            id: workspaceId,
            name: workspaceName,
            userId,
            pages: livePages,
            pendingSync: true,
          }),
        );
        if (writeShellOnline) {
          const result = await syncCachedWorkspacePages({
            supabase: createClient(),
            workspaceId,
            userId,
            workspaceName,
            pages: livePages,
          });
          if (!result.ok && result.reason !== "offline") {
            setNotice(
              result.message ||
                "Saved on this device. Sync to Grove will retry when editing is free.",
            );
            window.setTimeout(() => setNotice(""), 3200);
          }
        }
        setSavedAt(Date.now());
        return;
      }
      if (cloudMode && workspaceId && userId) {
        const supabase = createClient();
        const leaseToken = editLeaseTokenRef.current;
        if (!leaseToken) return;
        const { error } = await supabase.rpc("save_workspace_pages", {
          p_workspace_id: workspaceId,
          p_lease_token: leaseToken,
          p_pages: livePages.map((page, position) => ({
            id: page.id,
            parent_id: page.parentId,
            title: page.title || "Untitled",
            content: { html: page.content, unvisited: page.unvisited },
            page_type: page.pageType,
            fields: page.fields,
            position,
          })),
        });
        if (error) {
          setNotice("Cloud save failed. Your text is still on screen.");
          return;
        }
        await putCachedWorkspace(
          workspaceCacheSnapshot({
            id: workspaceId,
            name: workspaceName,
            userId,
            pages: livePages,
            pendingSync: false,
          }),
        );
      } else {
        localStorage.setItem("storytree-pages", JSON.stringify(pages));
        localStorage.setItem("storytree-active-page", activeId);
      }
      setSavedAt(Date.now());
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    pages,
    activeId,
    cloudMode,
    readOnly,
    userId,
    workspaceId,
    workspaceName,
    writeShell,
    writeShellOnline,
  ]);

  useEffect(() => {
    if (cloudMode || writeShell) return;
    localStorage.setItem("storytree-tags", JSON.stringify(tags));
    localStorage.setItem("storytree-page-tags", JSON.stringify(pageTags));
    localStorage.setItem(
      "storytree-relationships",
      JSON.stringify(relationships),
    );
  }, [cloudMode, pageTags, relationships, tags, writeShell]);

  useEffect(() => {
    if (readOnly || writeShell) return;
    const timer = window.setTimeout(async () => {
      if (cloudMode && workspaceId) {
        const { error } = await createClient()
          .rpc("save_workspace_geography", {
            project_id: workspaceId,
            map_document: geography,
          });
        if (error) {
          setNotice("The geography map could not be saved.");
          window.setTimeout(() => setNotice(""), 2600);
        }
      } else {
        localStorage.setItem("storytree-geography", JSON.stringify(geography));
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [cloudMode, geography, readOnly, workspaceId, writeShell]);

  const denyPlan = useCallback((feature: FeatureName) => {
    setNotice(planLimitMessage(feature));
    window.setTimeout(() => setNotice(""), 2800);
  }, []);

  const blockReadOnly = useCallback(() => {
    setNotice(
      editLease.status === "blocked"
        ? isOwnEditLock(editLease.holderEmail, userEmail)
          ? "This story is already open in another Grove window."
          : `${editLease.holderEmail || "Another collaborator"} is editing this story right now.`
        : workspaceRole === "viewer"
        ? "Reviewers can comment and suggest, but cannot change the story."
        : workspaceRole === "editor"
          ? "This story is read-only under its owner’s current plan."
          : "This story is read-only. Make it your Active Free Story to edit it.",
    );
    window.setTimeout(() => setNotice(""), 2800);
  }, [editLease, userEmail, workspaceRole]);

  const openAi = useCallback(
    (selectedText = "") => {
      if (!canUseFeature("aiAsk", planAccess)) {
        denyPlan("aiAsk");
        return;
      }
      setSelection(selectedText);
      setAiOpen(true);
      setReviewOpen(false);
      setSidebarOpen(false);
    },
    [denyPlan, planAccess],
  );

  useEffect(() => {
    function onAskShortcut(event: KeyboardEvent) {
      if (
        event.altKey &&
        event.key.toLowerCase() === "a" &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        openAi();
      }
    }
    window.addEventListener("keydown", onAskShortcut);
    return () => window.removeEventListener("keydown", onAskShortcut);
  }, [openAi]);

  useEffect(() => {
    if (!importChapterOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setImportChapterOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [importChapterOpen]);

  const activePage = pages.find((page) => page.id === activeId) ?? pages[0];
  const tagTarget =
    pages.find((page) => page.id === tagTargetId) ?? null;
  const tagPickerPage =
    pages.find((page) => page.id === tagPickerTargetId) ?? null;
  const storyPages = useMemo(
    () =>
      filterStoryPages(
        pages.filter((page) => {
          if (isSidebarListType(page.pageType)) return false;
          return (
            !isChapterNestedEvent(pages, page) &&
            !isScriptNestedEvent(pages, page)
          );
        }),
        { types: storyTypeFilter, query: search },
      ),
    [pages, search, storyTypeFilter],
  );
  useEffect(() => {
    if (storyTypeFilter.length === 0 && !search.trim()) return;
    setExpanded((current) => {
      const next = new Set(current);
      const byId = new Map(pages.map((page) => [page.id, page]));
      let changed = false;
      for (const page of storyPages) {
        let parentId = page.parentId;
        while (parentId) {
          if (!next.has(parentId)) {
            next.add(parentId);
            changed = true;
          }
          parentId = byId.get(parentId)?.parentId ?? null;
        }
      }
      return changed ? next : current;
    });
  }, [pages, search, storyPages, storyTypeFilter]);
  const chapterPages = useMemo(() => {
    const chapters = pages.filter((page) => page.pageType === "chapter");
    const query = search.trim().toLowerCase();
    if (!query) return chapters;
    return chapters.filter(
      (chapter) =>
        chapter.title.toLowerCase().includes(query) ||
        chapterEventChildren(pages, chapter.id).some((event) =>
          event.title.toLowerCase().includes(query),
        ),
    );
  }, [pages, search]);
  const scriptPages = useMemo(() => {
    const scripts = pages.filter((page) => page.pageType === "script");
    const query = search.trim().toLowerCase();
    if (!query) return scripts;
    return scripts.filter(
      (script) =>
        script.title.toLowerCase().includes(query) ||
        scriptEventChildren(pages, script.id).some((event) =>
          event.title.toLowerCase().includes(query),
        ),
    );
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
      if (readOnly) {
        blockReadOnly();
        return null;
      }
      if (!canCreatePage(pages.length, planAccess)) {
        denyPlan("extraPages");
        return null;
      }
      const page: StoryPage = {
        id: makeId(),
        parentId: isSidebarListType(pageType) ? null : parentId,
        title,
        content: "<p></p>",
        pageType,
        fields,
        unvisited: !activate,
        updatedAt: Date.now(),
      };
      setPages((current) => {
        let next = [...current, page];
        if (parentId && pageType === "event") {
          const parent = next.find((candidate) => candidate.id === parentId);
          if (parent?.pageType === "chapter") {
            next = next.map((candidate) =>
              candidate.id === parentId
                ? {
                    ...candidate,
                    content: insertChapterEventMarker(
                      candidate.content,
                      page.id,
                    ),
                    updatedAt: Date.now(),
                  }
                : candidate,
            );
          }
        }
        if (parentId && pageType === "script_event") {
          const parent = next.find((candidate) => candidate.id === parentId);
          if (parent?.pageType === "script") {
            next = next.map((candidate) =>
              candidate.id === parentId
                ? {
                    ...candidate,
                    content: insertScriptEventMarker(
                      candidate.content,
                      page.id,
                    ),
                    updatedAt: Date.now(),
                  }
                : candidate,
            );
          }
        }
        return next;
      });
      if (pageType === "chapter" || (parentId && pageType === "event")) {
        setChaptersOpen(true);
      }
      if (pageType === "script" || (parentId && pageType === "script_event")) {
        setScriptsOpen(true);
      }
      if (parentId) {
        setExpanded((current) => new Set(current).add(parentId));
      }
      if (activate) setActiveId(page.id);
      if (
        parentId &&
        ((pageType === "event" && parentId === activeId && !activate) ||
          (pageType === "script_event" && parentId === activeId && !activate))
      ) {
        setEditorNonce((current) => current + 1);
      }
      return page;
    },
    [activeId, blockReadOnly, denyPlan, pages.length, planAccess, readOnly],
  );

  const movePage = useCallback(
    (draggedId: string, drop: PageDrop) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
      setPages((current) => {
        const dragged = current.find((page) => page.id === draggedId);
        const oldParentId = dragged?.parentId ?? null;
        const next = applyPageDrop(current, draggedId, drop);
        if (!next) return current;
        const moved = next.find((page) => page.id === draggedId);
        let patched = next.map((page) =>
          page.id === draggedId ? { ...page, updatedAt: Date.now() } : page,
        );
        if (dragged?.pageType === "event") {
          if (oldParentId && oldParentId !== moved?.parentId) {
            patched = patched.map((page) =>
              page.id === oldParentId && page.pageType === "chapter"
                ? {
                    ...page,
                    content: removeChapterEventMarker(page.content, draggedId),
                    updatedAt: Date.now(),
                  }
                : page,
            );
          }
          if (
            moved?.parentId &&
            moved.parentId !== oldParentId
          ) {
            patched = patched.map((page) =>
              page.id === moved.parentId && page.pageType === "chapter"
                ? {
                    ...page,
                    content: insertChapterEventMarker(page.content, draggedId),
                    updatedAt: Date.now(),
                  }
                : page,
            );
          }
        }
        if (dragged?.pageType === "script_event") {
          if (oldParentId && oldParentId !== moved?.parentId) {
            patched = patched.map((page) =>
              page.id === oldParentId && page.pageType === "script"
                ? {
                    ...page,
                    content: removeScriptEventMarker(page.content, draggedId),
                    updatedAt: Date.now(),
                  }
                : page,
            );
          }
          if (moved?.parentId && moved.parentId !== oldParentId) {
            patched = patched.map((page) =>
              page.id === moved.parentId && page.pageType === "script"
                ? {
                    ...page,
                    content: insertScriptEventMarker(page.content, draggedId),
                    updatedAt: Date.now(),
                  }
                : page,
            );
          }
        }
        return patched;
      });
      if (drop.type === "inside") {
        setExpanded((current) => new Set(current).add(drop.targetId));
      }
      const dragged = pages.find((page) => page.id === draggedId);
      if (!dragged) return;
      if (drop.type === "inside") {
        const target = pages.find((page) => page.id === drop.targetId);
        if (target) {
          setNotice(
            `Moved ${dragged.title || "Untitled"} inside ${
              target.title || "Untitled"
            }`,
          );
        }
      } else if (drop.type === "root") {
        setNotice(`Moved ${dragged.title || "Untitled"} to Your story`);
      }
      window.setTimeout(() => setNotice(""), 1800);
    },
    [blockReadOnly, pages, readOnly],
  );

  const startPageDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, pageId: string) => {
      if (readOnly || search.trim() || sidebarWidth < 112) return;
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
    [readOnly, search, sidebarWidth],
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
      const chapterRow = node?.closest<HTMLElement>("[data-chapter-id]");
      const scriptRow = node?.closest<HTMLElement>("[data-script-id]");
      const targetId =
        row?.dataset.pageId ??
        chapterRow?.dataset.chapterId ??
        scriptRow?.dataset.scriptId;
      const ontoRoot = Boolean(node?.closest("[data-story-root]"));
      if (targetId && targetId !== drag.pageId) {
        const drop: PageDrop = { type: "inside", targetId };
        const preview = applyPageDrop(pages, drag.pageId, drop);
        if (!preview) {
          drag.drop = null;
          setDropTarget(null);
          return;
        }
        drag.drop = drop;
        setDropTarget(drop);
        return;
      }
      if (ontoRoot) {
        const drop: PageDrop = { type: "root" };
        const preview = applyPageDrop(pages, drag.pageId, drop);
        if (!preview) {
          drag.drop = null;
          setDropTarget(null);
          return;
        }
        drag.drop = drop;
        setDropTarget(drop);
        return;
      }
      drag.drop = null;
      setDropTarget(null);
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

  const moveListPage = useCallback(
    (
      listType: "chapter" | "script",
      draggedId: string,
      drop: { type: "before" | "after"; targetId: string },
    ) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
      setPages((current) => {
        const remaining = current.filter(
          (page) => page.pageType === listType && page.id !== draggedId,
        );
        const targetIndex = remaining.findIndex(
          (page) => page.id === drop.targetId,
        );
        const beforeId =
          drop.type === "before"
            ? drop.targetId
            : remaining[targetIndex + 1]?.id ?? null;
        return reorderAmong(
          current,
          (page) => page.pageType === listType,
          draggedId,
          beforeId,
        ).map((page) =>
          page.id === draggedId ? { ...page, updatedAt: Date.now() } : page,
        );
      });
    },
    [blockReadOnly, readOnly],
  );

  const startListDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      pageId: string,
      list: "chapter" | "script",
    ) => {
      if (readOnly || search.trim() || sidebarWidth < 112) return;
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
        list,
      };
    },
    [readOnly, search, sidebarWidth],
  );

  const updateListDrag = useCallback(
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
      const selector =
        drag.list === "script" ? "[data-script-id]" : "[data-chapter-id]";
      const row = node?.closest<HTMLElement>(selector);
      const targetId =
        drag.list === "script" ? row?.dataset.scriptId : row?.dataset.chapterId;
      if (!row || !targetId || targetId === drag.pageId) {
        drag.drop = null;
        setDropTarget(null);
        return;
      }
      const rect = row.getBoundingClientRect();
      const drop: PageDrop = {
        type: dropPlacementFromOffset(
          (event.clientY - rect.top) / rect.height,
        ),
        targetId,
      };
      drag.drop = drop;
      setDropTarget(drop);
    },
    [],
  );

  const finishListDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = pageDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const list = drag.list;
      pageDragRef.current = null;
      document.body.classList.remove("dragging-pages");
      const drop = drag.drop;
      const pageId = drag.pageId;
      setDraggingId(null);
      setDropTarget(null);
      if (
        drag.started &&
        list &&
        drop &&
        (drop.type === "before" || drop.type === "after")
      ) {
        moveListPage(list, pageId, { type: drop.type, targetId: drop.targetId });
      }
    },
    [moveListPage],
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
      if (!page) return null;
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
      if (readOnly) {
        blockReadOnly();
        return;
      }
      if (!pageId || !pages.some((page) => page.id === pageId)) {
        setNotice(
          "Create a page link or place the cursor beside one before using /t.",
        );
        window.setTimeout(() => setNotice(""), 2800);
        return;
      }
      setTagPickerTargetId(pageId);
    },
    [blockReadOnly, pages, readOnly],
  );

  const togglePageTag = useCallback(
    async (pageId: string, tagId: string) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
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
    [blockReadOnly, cloudMode, pageTags, readOnly],
  );

  const createAndAssignTag = useCallback(
    async (pageId: string, requestedName: string, requestedColor: string) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
      const name = normalizeTagName(requestedName);
      const color = normalizeTagColor(requestedColor);
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
              color,
              created_by: userId,
            })
            .select("id,name,color")
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
          tag = { ...data, color: normalizeTagColor(data.color) };
        } else {
          tag = { id: makeId(), name, color };
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
    [
      blockReadOnly,
      cloudMode,
      pageTags,
      readOnly,
      tags,
      togglePageTag,
      userId,
      workspaceId,
    ],
  );

  const updatePage = useCallback(
    (
      pageId: string,
      patch: Partial<
        Pick<StoryPage, "title" | "content" | "pageType" | "fields">
      >,
    ) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
      setPages((current) =>
        current.map((page) =>
          page.id === pageId
            ? { ...page, ...patch, updatedAt: Date.now() }
            : page,
        ),
      );
    },
    [blockReadOnly, readOnly],
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
    if (readOnly) {
      blockReadOnly();
      return;
    }
    setPages((current) => {
      const previous = current.find((page) => page.id === pageId);
      let next = applyPageTypeChange(current, pageId, pageType).map((page) => {
        if (page.id !== pageId) {
          return page.parentId === null
            ? { ...page, updatedAt: Date.now() }
            : page;
        }
        let content =
          pageType === "script" || pageType === "script_event"
            ? htmlToScriptHtml(page.content)
            : page.content;
        if (previous?.pageType === "chapter" && pageType !== "chapter") {
          content = syncChapterEventMarkers(content, []);
        }
        if (previous?.pageType === "script" && pageType !== "script") {
          content = syncScriptEventMarkers(content, []);
        }
        return {
          ...page,
          content,
          fields: isTimelinePageType(pageType)
            ? page.fields
            : withoutTimelineY(page.fields),
          updatedAt: Date.now(),
        };
      });
      if (pageType === "chapter") {
        const eventIds = chapterEventChildren(next, pageId).map(
          (event) => event.id,
        );
        next = next.map((page) =>
          page.id === pageId
            ? {
                ...page,
                content: syncChapterEventMarkers(page.content, eventIds),
              }
            : page,
        );
      }
      if (pageType === "script") {
        const eventIds = scriptEventChildren(next, pageId).map(
          (event) => event.id,
        );
        next = next.map((page) =>
          page.id === pageId
            ? {
                ...page,
                content: syncScriptEventMarkers(page.content, eventIds),
              }
            : page,
        );
      }
      return next;
    });
    if (pageType === "chapter") setChaptersOpen(true);
    if (pageType === "script" || pageType === "script_event") {
      setScriptsOpen(true);
      setEditorNonce((current) => current + 1);
    }
  }, [blockReadOnly, readOnly]);

  useEffect(() => {
    if (!activePage || activePage.pageType !== "chapter" || readOnly) return;
    const eventIds = chapterEventChildren(pages, activePage.id).map(
      (event) => event.id,
    );
    const next = syncChapterEventMarkers(activePage.content, eventIds);
    if (next === activePage.content) return;
    updatePage(activePage.id, { content: next });
  }, [activePage, pages, readOnly, updatePage]);

  useEffect(() => {
    if (!activePage || activePage.pageType !== "script" || readOnly) return;
    const eventIds = scriptEventChildren(pages, activePage.id).map(
      (event) => event.id,
    );
    const next = syncScriptEventMarkers(activePage.content, eventIds);
    if (next === activePage.content) return;
    updatePage(activePage.id, { content: next });
  }, [activePage, pages, readOnly, updatePage]);

  const importChapterIntoScript = useCallback(
    (chapterId: string) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
      const chapter = pages.find(
        (page) => page.id === chapterId && page.pageType === "chapter",
      );
      if (!chapter || activePage.pageType !== "script") return;
      const incoming = proseToScriptHtml(chapter.content);
      const next = mergeScriptHtml(activePage.content, incoming);
      updateActivePage({
        content: next,
        title:
          !activePage.title.trim() || activePage.title === "Untitled"
            ? chapter.title
            : activePage.title,
      });
      setEditorNonce((current) => current + 1);
      setImportChapterOpen(false);
      setNotice(`Imported ${chapter.title || "Untitled"} as a first-pass script.`);
      window.setTimeout(() => setNotice(""), 2200);
    },
    [
      activePage.content,
      activePage.pageType,
      activePage.title,
      blockReadOnly,
      pages,
      readOnly,
      updateActivePage,
    ],
  );

  const openRelatePicker = useCallback(
    (pageId: string | null) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
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
    [activeId, blockReadOnly, pages, readOnly],
  );

  const createRelationship = useCallback(
    async (
      fromPageId: string,
      toPageId: string,
      requestedLabel: string,
      kind: FamilyRelationshipKind | null = null,
    ) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
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
        kind,
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
            kind,
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
    [blockReadOnly, cloudMode, readOnly, relationships, workspaceId],
  );

  const createFamilyRelationship = useCallback(
    (
      fromPageId: string,
      toPageId: string,
      kind: FamilyRelationshipKind,
    ) => {
      const pair = canonicalFamilyPair(fromPageId, toPageId, kind);
      const error = validateFamilyRelationship({
        pages,
        relationships,
        ...pair,
        kind,
      });
      if (error) {
        setNotice(error);
        window.setTimeout(() => setNotice(""), 2600);
        return;
      }
      void createRelationship(
        pair.fromPageId,
        pair.toPageId,
        FAMILY_RELATIONSHIP_LABELS[kind],
        kind,
      );
    },
    [createRelationship, pages, relationships],
  );

  const uploadGeographyBackground = useCallback(
    async (file: File) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setNotice("Map images must be 5 MB or smaller.");
        return;
      }
      if (!cloudMode || !workspaceId) {
        if (file.size > 2 * 1024 * 1024) {
          setNotice("Local map backgrounds must be 2 MB or smaller.");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== "string") return;
          localStorage.setItem("storytree-geography-background", reader.result);
          setGeographyBackgroundUrl(reader.result);
          setGeography((current) => ({
            ...current,
            background: current.background ?? {
              opacity: 0.65,
              fit: "contain",
            },
          }));
        };
        reader.readAsDataURL(file);
        return;
      }
      const form = new FormData();
      form.set("background", file);
      const response = await fetch(
        `/api/workspaces/${workspaceId}/geography-background`,
        { method: "POST", body: form },
      );
      const result = (await response.json()) as {
        backgroundUrl?: string | null;
        error?: string;
      };
      if (!response.ok || !result.backgroundUrl) {
        setNotice(result.error || "The map background could not be uploaded.");
        return;
      }
      setGeographyBackgroundUrl(result.backgroundUrl);
      setGeography((current) => ({
        ...current,
        background: current.background ?? { opacity: 0.65, fit: "contain" },
      }));
    },
    [blockReadOnly, cloudMode, readOnly, workspaceId],
  );

  const removeGeographyBackground = useCallback(async () => {
    if (readOnly) {
      blockReadOnly();
      return;
    }
    if (cloudMode && workspaceId) {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/geography-background`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setNotice(result.error || "The map background could not be removed.");
        return;
      }
    } else {
      localStorage.removeItem("storytree-geography-background");
    }
    setGeographyBackgroundUrl(null);
    setGeography((current) => ({ ...current, background: undefined }));
  }, [blockReadOnly, cloudMode, readOnly, workspaceId]);

  const deleteRelationship = useCallback(
    async (id: string) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
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
    [blockReadOnly, cloudMode, readOnly],
  );

  const deletePage = useCallback(
    async (id: string) => {
      if (readOnly) {
        blockReadOnly();
        return;
      }
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
        const supabase = createClient();
        const researchPaths = await researchImagePathsForPages(supabase, [
          ...deletedIds,
        ]);
        if (researchPaths.length) {
          const { error: storageError } = await supabase.storage
            .from(RESEARCH_IMAGES_BUCKET)
            .remove(researchPaths);
          if (storageError) {
            deletedIds.forEach((deletedId) =>
              deletingIds.current.delete(deletedId),
            );
            setNotice("This page could not be deleted.");
            return;
          }
        }
        const { error } = await supabase.from("pages").delete().eq("id", id);
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
    [activeId, blockReadOnly, cloudMode, pages, readOnly],
  );

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
    <main className={`workspace-shell${readOnly ? " read-only" : ""}`}>
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

          <div
            className={`sidebar-label ${
              dropTarget?.type === "root" ? "drop-root" : ""
            }`}
            data-story-root=""
          >
            <span>Your story</span>
            <div className="sidebar-label-actions">
              <button
                type="button"
                className={`icon-button ${
                  storyFilterOpen || storyTypeFilter.length ? "active" : ""
                }`}
                aria-label="Filter by page type"
                aria-pressed={storyFilterOpen}
                title="Filter by page type"
                onClick={() => setStoryFilterOpen((current) => !current)}
              >
                <ListFilter size={15} />
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Create root page"
                  onClick={() => createPage()}
                >
                  <Plus size={15} />
                </button>
              )}
            </div>
          </div>
          {storyFilterOpen && (
            <div className="story-type-filter" role="group" aria-label="Page types">
              <button
                type="button"
                className={storyTypeFilter.length === 0 ? "active" : ""}
                onClick={() => setStoryTypeFilter([])}
              >
                All
              </button>
              {STORY_PAGE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={storyTypeFilter.includes(type) ? "active" : ""}
                  onClick={() =>
                    setStoryTypeFilter((current) =>
                      current.includes(type)
                        ? current.filter((item) => item !== type)
                        : [...current, type],
                    )
                  }
                >
                  {PAGE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}

          <nav className="page-tree" aria-label="Story pages" data-story-root="">
            {draggingId && dropTarget && (
              <div className="page-drop-hint" role="status">
                {dropTarget.type === "inside"
                  ? `Drop inside ${
                      pages.find((page) => page.id === dropTarget.targetId)
                        ?.title || "page"
                    }`
                  : dropTarget.type === "root"
                    ? "Drop into Your story"
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
            {storyPages.length === 0 ? (
              <p className="sidebar-empty-hint">
                {storyTypeFilter.length || search.trim()
                  ? "No pages match this filter."
                  : "Add a page to start your story."}
              </p>
            ) : (
              <PageBranch
              pages={storyPages}
              allPages={storyPages}
              parentId={null}
              activeId={activeId}
              expanded={expanded}
              draggingId={draggingId}
              dropTarget={dropTarget}
              canDrag={!readOnly && !search.trim() && sidebarMode !== "rail"}
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
              onUnnest={
                readOnly
                  ? undefined
                  : (id) => movePage(id, { type: "root" })
              }
              onDelete={deletePage}
              onDragStart={startPageDrag}
              onDragMove={updatePageDrag}
              onDragEnd={finishPageDrag}
            />
            )}
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
              {!readOnly && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Create chapter"
                  title="Create chapter"
                  onClick={() => createPage(null, "Untitled", true, "chapter")}
                >
                  <Plus size={15} />
                </button>
              )}
              <button
                type="button"
                className="icon-button chapter-export"
                aria-label="Export manuscript"
                title="Print chapters as PDF"
                onClick={() => {
                  if (!canUseFeature("chapterPdf", planAccess)) {
                    denyPlan("chapterPdf");
                    return;
                  }
                  setExportKind("chapter");
                }}
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
                  chapterPages.map((page) => {
                    const nestedEvents = chapterEventChildren(pages, page.id);
                    const selectPage = (id: string) => {
                      setActiveId(id);
                      setTagTargetId(null);
                      setTagPickerTargetId(null);
                      setPages((current) =>
                        current.map((candidate) =>
                          candidate.id === id && candidate.unvisited
                            ? { ...candidate, unvisited: false }
                            : candidate,
                        ),
                      );
                      if (isNarrow) setSidebarOpen(false);
                    };
                    return (
                      <div key={page.id} className="chapter-tree">
                    <div
                      data-chapter-id={page.id}
                      className={`page-row ${
                        activeId === page.id ? "active" : ""
                      } ${page.unvisited ? "unvisited" : ""} ${
                        draggingId === page.id ? "dragging" : ""
                      } ${
                        dropTargetId(dropTarget) === page.id
                          ? `drop-${dropTarget?.type}`
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
                            startListDrag(event, page.id, "chapter")
                          }
                          onPointerMove={updateListDrag}
                          onPointerUp={finishListDrag}
                          onPointerCancel={finishListDrag}
                          onLostPointerCapture={finishListDrag}
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
                        onClick={() => selectPage(page.id)}
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
                      {!readOnly && (
                        <button
                          type="button"
                          className="row-add"
                          aria-label={`Add event in ${page.title || "Untitled"}`}
                          title="Add a nested event"
                          onClick={() =>
                            createPage(page.id, "Untitled", true, "event")
                          }
                        >
                          <Plus size={13} />
                        </button>
                      )}
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
                    {nestedEvents.map((event) => (
                      <div
                        key={event.id}
                        data-page-id={event.id}
                        className={`page-row chapter-event-row ${
                          activeId === event.id ? "active" : ""
                        } ${event.unvisited ? "unvisited" : ""} ${
                          draggingId === event.id ? "dragging" : ""
                        } ${
                          dropTargetId(dropTarget) === event.id
                            ? `drop-${dropTarget?.type}`
                            : ""
                        }`}
                      >
                        {sidebarMode !== "rail" && !search.trim() && (
                          <button
                            type="button"
                            className="page-drag-handle"
                            aria-label={`Move ${event.title || "Untitled"}`}
                            title="Drag onto Your story to un-nest"
                            onPointerDown={(pointer) =>
                              startPageDrag(pointer, event.id)
                            }
                            onPointerMove={updatePageDrag}
                            onPointerUp={finishPageDrag}
                            onPointerCancel={finishPageDrag}
                            onLostPointerCapture={finishPageDrag}
                          >
                            <GripVertical size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="page-name"
                          data-initial={(event.title || "Untitled")
                            .charAt(0)
                            .toUpperCase()}
                          title={event.title || "Untitled"}
                          onClick={() => selectPage(event.id)}
                        >
                          <Clock3 size={15} />
                          {event.unvisited && (
                            <span
                              className="unvisited-page-dot"
                              title="New page"
                            />
                          )}
                          <span>{event.title || "Untitled"}</span>
                        </button>
                        <button
                          type="button"
                          className="row-delete"
                          aria-label={`Delete ${event.title}`}
                          title="Delete event"
                          onClick={() => deletePage(event.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                      </div>
                    );
                  })
                )}
              </nav>
            )}
          </section>

          <section
            className={`sidebar-chapters ${scriptsOpen ? "open" : "collapsed"}`}
          >
            <div className="chapter-section-heading">
              <button
                type="button"
                className="tag-section-heading"
                aria-expanded={scriptsOpen}
                onClick={() => setScriptsOpen((current) => !current)}
              >
                {scriptsOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <Clapperboard size={14} />
                <span>Scripts</span>
                <small>{scriptPages.length}</small>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Create script"
                  title="Create script"
                  onClick={() => createPage(null, "Untitled", true, "script")}
                >
                  <Plus size={15} />
                </button>
              )}
              <button
                type="button"
                className="icon-button chapter-export"
                aria-label="Export script"
                title="Print scripts as PDF"
                onClick={() => {
                  if (!canUseFeature("chapterPdf", planAccess)) {
                    denyPlan("chapterPdf");
                    return;
                  }
                  setExportKind("script");
                }}
              >
                <Printer size={15} />
              </button>
            </div>
            {scriptsOpen && (
              <nav className="sidebar-chapter-list" aria-label="Scripts">
                {scriptPages.length === 0 ? (
                  <p className="sidebar-empty-hint">
                    Set a page type to Script, or add one here.
                  </p>
                ) : (
                  scriptPages.map((page) => {
                    const nestedEvents = scriptEventChildren(pages, page.id);
                    const selectPage = (id: string) => {
                      setActiveId(id);
                      setTagTargetId(null);
                      setTagPickerTargetId(null);
                      setPages((current) =>
                        current.map((candidate) =>
                          candidate.id === id && candidate.unvisited
                            ? { ...candidate, unvisited: false }
                            : candidate,
                        ),
                      );
                      if (isNarrow) setSidebarOpen(false);
                    };
                    return (
                      <div key={page.id} className="chapter-tree">
                    <div
                      data-script-id={page.id}
                      className={`page-row ${
                        activeId === page.id ? "active" : ""
                      } ${page.unvisited ? "unvisited" : ""} ${
                        draggingId === page.id ? "dragging" : ""
                      } ${
                        dropTargetId(dropTarget) === page.id
                          ? `drop-${dropTarget?.type}`
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
                            startListDrag(event, page.id, "script")
                          }
                          onPointerMove={updateListDrag}
                          onPointerUp={finishListDrag}
                          onPointerCancel={finishListDrag}
                          onLostPointerCapture={finishListDrag}
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
                        onClick={() => selectPage(page.id)}
                      >
                        <Clapperboard size={15} />
                        {page.unvisited && (
                          <span
                            className="unvisited-page-dot"
                            title="New page"
                          />
                        )}
                        <span>{page.title || "Untitled"}</span>
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          className="row-add"
                          aria-label={`Add script event in ${page.title || "Untitled"}`}
                          title="Add a nested script event"
                          onClick={() =>
                            createPage(page.id, "Untitled", true, "script_event")
                          }
                        >
                          <Plus size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="row-delete"
                        aria-label={`Delete ${page.title}`}
                        title="Delete script"
                        onClick={() => deletePage(page.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {nestedEvents.map((event) => (
                      <div
                        key={event.id}
                        data-page-id={event.id}
                        className={`page-row chapter-event-row ${
                          activeId === event.id ? "active" : ""
                        } ${event.unvisited ? "unvisited" : ""} ${
                          draggingId === event.id ? "dragging" : ""
                        } ${
                          dropTargetId(dropTarget) === event.id
                            ? `drop-${dropTarget?.type}`
                            : ""
                        }`}
                      >
                        {sidebarMode !== "rail" && !search.trim() && (
                          <button
                            type="button"
                            className="page-drag-handle"
                            aria-label={`Move ${event.title || "Untitled"}`}
                            title="Drag onto Your story to un-nest"
                            onPointerDown={(pointer) =>
                              startPageDrag(pointer, event.id)
                            }
                            onPointerMove={updatePageDrag}
                            onPointerUp={finishPageDrag}
                            onPointerCancel={finishPageDrag}
                            onLostPointerCapture={finishPageDrag}
                          >
                            <GripVertical size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="page-name"
                          data-initial={(event.title || "Untitled")
                            .charAt(0)
                            .toUpperCase()}
                          title={event.title || "Untitled"}
                          onClick={() => selectPage(event.id)}
                        >
                          <Clapperboard size={15} />
                          {event.unvisited && (
                            <span
                              className="unvisited-page-dot"
                              title="New page"
                            />
                          )}
                          <span>{event.title || "Untitled"}</span>
                        </button>
                        <button
                          type="button"
                          className="row-delete"
                          aria-label={`Delete ${event.title}`}
                          title="Delete script event"
                          onClick={() => deletePage(event.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                      </div>
                    );
                  })
                )}
              </nav>
            )}
          </section>

          {tagsOpen && !writeShell && (
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
          {!writeShell && (
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
                        style={tagColorStyle(tag.color)}
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
                        <span className="tag-color-dot" aria-hidden="true" />
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
          )}

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
                  router.replace("/");
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

      {isNarrow && (sidebarOpen || aiOpen || reviewOpen) && (
        <button
          type="button"
          className="workspace-backdrop"
          aria-label="Close open panel"
          onClick={() => {
            setSidebarOpen(false);
            setAiOpen(false);
            setReviewOpen(false);
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
                  setReviewOpen(false);
                }}
                aria-label="Open sidebar"
              >
                <Menu size={19} />
              </button>
            )}
            <button
              type="button"
              className="dashboard-return"
              onClick={() => router.push(writeShell ? "/write" : "/dashboard")}
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
            {reviewOpen && (
              <>
                <ChevronRight size={14} />
                <strong>Review</strong>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {!researchOpen && !relationshipsOpen && (
              <span className="save-state">
                {writeShell && !writeShellOnline
                  ? savedAt
                    ? "Saved on device"
                    : "Saving on device…"
                  : savedAt
                    ? "Saved"
                    : "Saving…"}
              </span>
            )}
            {!writeShell && !researchOpen && !relationshipsOpen && (
              <button
                type="button"
                className={`research-button ${researchOpen ? "active" : ""}`}
                onClick={() => {
                  if (!canUseFeature("research", planAccess)) {
                    denyPlan("research");
                    return;
                  }
                  setResearchOpen((current) => !current);
                  setRelationshipsOpen(false);
                  setAiOpen(false);
                  setReviewOpen(false);
                  setSidebarOpen(false);
                }}
              >
                <LibraryBig size={15} />
                <span>{researchOpen ? "Writing" : "Research"}</span>
              </button>
            )}
            {!writeShell && !researchOpen && (
              <button
                type="button"
                className={`research-button ${relationshipsOpen ? "active" : ""}`}
                onClick={() => {
                  if (!canUseFeature("relationships", planAccess)) {
                    denyPlan("relationships");
                    return;
                  }
                  setRelationshipsOpen((current) => !current);
                  setResearchOpen(false);
                  setAiOpen(false);
                  setReviewOpen(false);
                  setSidebarOpen(false);
                }}
              >
                <GitFork size={15} />
                <span>{relationshipsOpen ? "Writing" : "Relationships"}</span>
              </button>
            )}
            {!writeShell && !researchOpen && !relationshipsOpen && (
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
            {!writeShell && canComment && !researchOpen && !relationshipsOpen && (
              <button
                type="button"
                className={`research-button ${reviewOpen ? "active" : ""}`}
                onClick={() => {
                  setReviewOpen((current) => !current);
                  setAiOpen(false);
                  setSidebarOpen(false);
                }}
              >
                <MessageSquareText size={15} />
                <span>Review</span>
              </button>
            )}
            {!writeShell && isOwner && workspaceId && (
              <button
                type="button"
                className="help-button"
                title="Share story"
                aria-label="Share story"
                onClick={() => setShareOpen(true)}
              >
                <Users size={17} />
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

        {readOnly && editLease.status !== "checking" && (
          <div className="read-only-banner" role="status">
            <LockKeyhole size={14} />
            <span>
              {editLease.status === "blocked"
                ? editLockMessage(editLease.holderEmail, userEmail)
                : workspaceRole === "viewer"
                ? "You are a Reviewer. You can read, select and copy text, and leave comments or suggestions."
                : workspaceRole === "editor"
                  ? "This story is currently read-only under its owner’s plan. You can still comment and suggest."
                  : "This story is read-only. Your writing is safe and available to select and copy."}
            </span>
            {workspaceRole === "owner" &&
              editLease.status !== "blocked" && (
              <Link href="/dashboard">Choose Active Free Story</Link>
              )}
          </div>
        )}

        {researchOpen ? (
          <ResearchView
            key={activePage.id}
            pageId={activePage.id}
            pageTitle={activePage.title}
            cloudMode={cloudMode}
            userId={userId}
            readOnly={readOnly}
            onClose={() => setResearchOpen(false)}
          />
        ) : relationshipsOpen ? (
          <RelationshipsView
            pages={pages}
            relationships={relationships}
            geography={geography}
            geographyBackgroundUrl={geographyBackgroundUrl}
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
              return page?.id ?? null;
            }}
            onCreateFamilyRelationship={createFamilyRelationship}
            onDeleteRelationship={deleteRelationship}
            onGeographyChange={(next) => {
              if (readOnly) {
                blockReadOnly();
                return;
              }
              setGeography(next);
            }}
            onUploadGeographyBackground={uploadGeographyBackground}
            onRemoveGeographyBackground={removeGeographyBackground}
            onUpdatePage={updatePage}
          />
        ) : (
          <article className={`document ${activePage.pageType === "script" || activePage.pageType === "script_event" ? "script-document" : ""}`}>
            <div className="document-meta">
              <span>{PAGE_TYPE_LABELS[activePage.pageType].toUpperCase()}</span>
              <span>•</span>
              <span>Edited just now</span>
            </div>
            <div className="page-type-picker">
              <label>
                <span>Type</span>
                <select
                  value={activePage.pageType}
                  aria-label="Page type"
                  disabled={readOnly}
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
              {activePage.pageType === "script" && !readOnly && (
                <button
                  type="button"
                  className="script-import-button"
                  onClick={() => setImportChapterOpen(true)}
                >
                  Import a chapter
                </button>
              )}
            </div>
            {PAGE_TYPE_FIELDS[activePage.pageType].length > 0 && (
              <div className="page-type-fields">
                {PAGE_TYPE_FIELDS[activePage.pageType].map((field) => (
                  <label
                    key={field.key}
                    className={
                      field.key === "aka"
                        ? "aka-field"
                        : field.multiline
                          ? "synopsis-field"
                          : undefined
                    }
                  >
                    <span>{field.label}</span>
                    {field.multiline ? (
                      <textarea
                        value={activePage.fields[field.key] ?? ""}
                        readOnly={readOnly}
                        placeholder={field.placeholder}
                        rows={3}
                        onChange={(event) =>
                          updateActivePage({
                            fields: {
                              ...activePage.fields,
                              [field.key]: event.target.value,
                            },
                          })
                        }
                      />
                    ) : (
                      <input
                        value={activePage.fields[field.key] ?? ""}
                        readOnly={readOnly}
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
                    )}
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
                readOnly={readOnly}
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
            {(() => {
              const nestedPages = pages.filter(
                (page) =>
                  page.parentId === activePage.id &&
                  !(
                    activePage.pageType === "chapter" &&
                    page.pageType === "event"
                  ) &&
                  !(
                    activePage.pageType === "script" &&
                    page.pageType === "script_event"
                  ),
              );
              if (nestedPages.length === 0) return null;
              return (
                <div className="nested-pages-line" aria-label="Nested pages">
                  <span>NESTED PAGES:</span>{" "}
                  {nestedPages.map((page, index) => (
                    <span key={page.id}>
                      {index > 0 ? ", " : null}
                      <button
                        type="button"
                        className="nested-page-link"
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
                        }}
                      >
                        {page.title || "Untitled"}
                      </button>
                    </span>
                  ))}
                </div>
              );
            })()}
            {(pageTags[activePage.id] ?? []).length > 0 && (
              <div className="page-tag-list" aria-label="Page tags">
                {(pageTags[activePage.id] ?? []).map((tagId) => {
                  const tag = tags.find((candidate) => candidate.id === tagId);
                  return tag ? (
                    <button
                      type="button"
                      key={tag.id}
                      style={tagColorStyle(tag.color)}
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
            {activeRelations.length > 0 && !writeShell && (
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
                      {!readOnly && (
                        <button
                          type="button"
                          className="related-chip-remove"
                          aria-label="Remove relationship"
                          onClick={() => void deleteRelationship(item.id)}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            {activePage.pageType === "script" ||
            activePage.pageType === "script_event" ? (
              <ScriptEditor
                key={`${activePage.id}-${editorNonce}`}
                content={htmlToScriptHtml(activePage.content)}
                onChange={(content) => updateActivePage({ content })}
                readOnly={readOnly}
                writeShell={writeShell}
                onSelectionChange={(text) =>
                  setReviewSelection({ pageId: activePage.id, text })
                }
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
                characterNames={pages
                  .filter((page) => page.pageType === "character")
                  .flatMap((page) => [
                    page.title,
                    ...(pageTypeHasAka(page.pageType)
                      ? parseAkaNames(page.fields.aka)
                      : []),
                  ])}
                currentPageId={activePage.id}
                onFindLinks={(count) => {
                  setNotice(
                    count
                      ? `Linked ${count} ${count === 1 ? "name" : "names"}`
                      : "No matching page names on this page.",
                  );
                  window.setTimeout(() => setNotice(""), 2200);
                }}
                onRequestImport={() => setImportChapterOpen(true)}
                scriptEvents={
                  activePage.pageType === "script"
                    ? scriptEventChildren(pages, activePage.id).map((event) => ({
                        id: event.id,
                        title: event.title,
                        content: event.content,
                      }))
                    : undefined
                }
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
            ) : (
            <StoryEditor
              key={`${activePage.id}-${editorNonce}`}
              content={activePage.content}
              onChange={(content) => updateActivePage({ content })}
              readOnly={readOnly}
              writeShell={writeShell}
              onSelectionChange={(text) =>
                setReviewSelection({ pageId: activePage.id, text })
              }
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
              chapterEvents={
                activePage.pageType === "chapter"
                  ? chapterEventChildren(pages, activePage.id).map((event) => ({
                      id: event.id,
                      title: event.title,
                      content: event.content,
                    }))
                  : undefined
              }
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
            )}
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

      {reviewOpen && workspaceId && (
        <ReviewPanel
          key={activePage.id}
          pageId={activePage.id}
          pageTitle={activePage.title}
          userId={userId}
          selectedText={
            reviewSelection.pageId === activePage.id
              ? reviewSelection.text
              : ""
          }
          canResolve={canResolveComments}
          canModerate={isOwner}
          canApplySuggestions={!readOnly}
          onApplySuggestion={(quoted, suggestion) => {
            if (readOnly) {
              blockReadOnly();
              return false;
            }
            const next = applyQuotedSuggestion(
              activePage.content,
              quoted,
              suggestion,
            );
            if (!next) return false;
            updatePage(activePage.id, { content: next });
            setEditorNonce((current) => current + 1);
            return true;
          }}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {shareOpen && workspaceId && (
        <ShareDialog
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          onClose={() => setShareOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          provider={provider}
          model={model}
          apiKey={apiKey}
          secureStorage={cloudMode}
          isPaid={planAccess.isPaid}
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
      {importChapterOpen && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={() => setImportChapterOpen(false)}
        >
          <section
            className="script-import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="script-import-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">SCRIPT</span>
                <h2 id="script-import-title">Import a chapter</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close chapter import"
                onClick={() => setImportChapterOpen(false)}
              >
                <X size={17} />
              </button>
            </header>
            <p>
              Grove copies the chapter into this Script page as a first pass.
              The chapter itself is left alone.
            </p>
            {chapterPages.length === 0 ? (
              <p>No chapters yet. Set a page type to Chapter, then import it here.</p>
            ) : (
              <div className="script-import-list">
                {chapterPages.map((chapter) => (
                  <button
                    type="button"
                    key={chapter.id}
                    onClick={() => importChapterIntoScript(chapter.id)}
                  >
                    {chapter.title || "Untitled"}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tagPickerPage && !writeShell && (
        <TagPicker
          page={tagPickerPage}
          tags={tags}
          selectedTagIds={pageTags[tagPickerPage.id] ?? []}
          onToggle={(tagId) => void togglePageTag(tagPickerPage.id, tagId)}
          onCreate={(name, color) =>
            void createAndAssignTag(tagPickerPage.id, name, color)
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

      {exportKind && (
        <ManuscriptPreview
          projectTitle={workspaceName}
          kind={exportKind === "script" ? "script" : "manuscript"}
          chapters={pages
            .filter((page) =>
              exportKind === "script"
                ? page.pageType === "script"
                : page.pageType === "chapter",
            )
            .map((page) => ({
              id: page.id,
              title: page.title,
              content:
                exportKind === "script"
                  ? expandScriptEventMarkers(
                      page.content,
                      scriptEventChildren(pages, page.id).map((event) => ({
                        id: event.id,
                        content: event.content,
                      })),
                    )
                  : expandChapterEventMarkers(
                      page.content,
                      chapterEventChildren(pages, page.id).map((event) => ({
                        id: event.id,
                        content: event.content,
                      })),
                    ),
            }))}
          onClose={() => setExportKind(null)}
        />
      )}

      {notice && <div className="notice">{notice}</div>}
      {cloudMode && !writeShell && workspaceId && userId && (
        <CacheWorkspaceBridge
          enabled
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          userId={userId}
          pages={pages}
        />
      )}
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
  onAdd: (parentId: string, title?: string, activate?: boolean) => StoryPage | null;
  onUnnest?: (id: string) => void;
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
  onUnnest,
  onDelete,
  onDragStart,
  onDragMove,
  onDragEnd,
}: PageBranchProps) {
  return siblingPages(pages, parentId).map((page) => {
      const hasChildren = allPages.some((child) => child.parentId === page.id);
      return (
        <div key={page.id}>
          <div
            data-page-id={page.id}
            className={`page-row ${activeId === page.id ? "active" : ""} ${
              page.unvisited ? "unvisited" : ""
            } ${draggingId === page.id ? "dragging" : ""} ${
              dropTargetId(dropTarget) === page.id
                ? `drop-${dropTarget?.type}`
                : ""
            }`}
          >
            {canDrag && (
              <button
                type="button"
                className="page-drag-handle"
                aria-label={`Nest ${page.title || "Untitled"}`}
                title="Drag onto a page to nest, or onto Your story to un-nest"
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
            {page.parentId && onUnnest && (
              <button
                type="button"
                className="row-unnest"
                aria-label={`Un-nest ${page.title || "Untitled"}`}
                title="Move to Your story"
                onClick={() => onUnnest(page.id)}
              >
                <ListIndentDecrease size={14} />
              </button>
            )}
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
                onUnnest={onUnnest}
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
  onCreate: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedColor, setSelectedColor] = useState(DEFAULT_TAG_COLOR);
  const cleanQuery = normalizeTagName(query);
  const exactTag = tags.find(
    (tag) => tag.name.toLowerCase() === cleanQuery.toLowerCase(),
  );
  const filteredTags = filterTags(tags, cleanQuery);

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
              onCreate(cleanQuery, selectedColor);
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
                style={tagColorStyle(tag.color)}
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
            <div className="create-tag-panel">
              <div>
                <span>Choose a color</span>
                <div className="tag-color-palette" role="radiogroup">
                  {TAG_COLOR_PALETTE.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      role="radio"
                      aria-checked={selectedColor === color.value}
                      aria-label={color.name}
                      title={color.name}
                      className={selectedColor === color.value ? "active" : ""}
                      style={{ background: color.value }}
                      onClick={() => setSelectedColor(color.value)}
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="create-tag-option"
                style={tagColorStyle(selectedColor)}
                onClick={() => {
                  onCreate(cleanQuery, selectedColor);
                  setQuery("");
                }}
              >
                <span className="tag-option-mark">
                  <Plus size={13} />
                </span>
                <span>Create “{cleanQuery}”</span>
              </button>
            </div>
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
  isPaid,
  onSetPassword,
  onClose,
  onSave,
}: {
  provider: AiProvider;
  model: string;
  apiKey: string;
  secureStorage: boolean;
  isPaid: boolean;
  onSetPassword?: (password: string) => Promise<boolean>;
  onClose: () => void;
  onSave: (provider: AiProvider, model: string, apiKey: string) => void;
}) {
  const [nextProvider, setNextProvider] = useState(provider);
  const [nextModel, setNextModel] = useState(model);
  const [nextKey, setNextKey] = useState(apiKey);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [pane, setPane] = useState<"connection" | "changelog">("connection");
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
            <div className="settings-panes" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={pane === "connection"}
                onClick={() => setPane("connection")}
              >
                Connection
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={pane === "changelog"}
                onClick={() => setPane("changelog")}
              >
                Changelog
              </button>
            </div>
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
          {pane === "changelog" ? (
            <div className="changelog">
              {CHANGELOG.map((group) => (
                <section key={group.date} className="changelog-group">
                  <h3>{group.date}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <>
          <section className="settings-section">
            <div>
              <h3>Appearance</h3>
              <p>Night colors dim the page for writing in low light.</p>
            </div>
            <NightToggle />
          </section>
          <section className="settings-section">
            <div>
              <h3>Grove Plus</h3>
              <p>
                Free includes 1 story and 50 pages. Plus unlocks more stories,
                unlimited pages, Ask AI, Research, review, and chapter PDF.
                {isPaid
                  ? " Grove Plus is on for this account."
                  : " Account & billing is where you subscribe or manage the plan."}
              </p>
            </div>
            <Link
              href="/account/billing"
              className="inline-save-button settings-billing-link"
            >
              Account &amp; billing
            </Link>
          </section>
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
            </>
          )}
        </div>
        {pane === "connection" && (
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
        )}
      </section>
    </div>
  );
}
