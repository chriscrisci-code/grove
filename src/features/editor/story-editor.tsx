"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  FilePlus2,
  GitFork,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Mic,
  MicOff,
  Quote,
  Tag,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChapterEvent,
  ChapterEventContext,
  type ChapterEventInfo,
} from "@/features/editor/chapter-event-node";
import { eventIdsInChapterHtml } from "@/features/editor/chapter-events";
import {
  isChapterEventDragging,
  watchChapterEventDragScroll,
} from "@/features/editor/chapter-event-scroll";
import { findPageTitleMatches } from "@/features/editor/find-page-links";
import {
  mergeDictationTranscript,
  shouldKeepDictationAlive,
} from "@/features/editor/dictation";
import {
  lookupWord,
  matchCasing,
  wordRangeAt,
  type WordLookup,
  type WordRange,
} from "@/features/editor/word-lookup";
import { WordMenu } from "@/features/editor/word-menu";

type SpeechResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechResult;
  };
};

type SpeechRecognitionErrorLike = {
  error: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const StoryLink = Link.extend({
  inclusive: false,
});

type StoryEditorProps = {
  content: string;
  onChange: (html: string) => void;
  onCreatePage: (
    title: string,
    linkSelection: (href: string) => void,
  ) => { id: string; title: string } | null;
  onOpenAi: (selection: string) => void;
  tagTarget: { id: string; title: string } | null;
  onTagTargetChange: (pageId: string | null) => void;
  onOpenTags: (pageId: string | null) => void;
  onOpenRelate: (pageId: string | null) => void;
  onNavigatePage: (pageId: string) => void;
  chapterEvents?: ChapterEventInfo[];
  onEventMarkersChange?: (eventIds: string[]) => void;
  linkablePages: { id: string; title: string; aliases?: string[] }[];
  currentPageId: string;
  onFindLinks: (count: number) => void;
  readOnly?: boolean;
  onSelectionChange?: (text: string) => void;
};

export function StoryEditor({
  content,
  onChange,
  onCreatePage,
  onOpenAi,
  tagTarget,
  onTagTargetChange,
  onOpenTags,
  onOpenRelate,
  onNavigatePage,
  chapterEvents,
  onEventMarkersChange,
  linkablePages,
  currentPageId,
  onFindLinks,
  readOnly = false,
  onSelectionChange,
}: StoryEditorProps) {
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [dictationStatus, setDictationStatus] = useState("");
  const [wordMenu, setWordMenu] = useState<(WordRange & { x: number; y: number }) | null>(
    null,
  );
  const [wordLookup, setWordLookup] = useState<WordLookup | null>(null);
  const [wordLookupLoading, setWordLookupLoading] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const committedSpeechRef = useRef("");
  const dictationFromRef = useRef(0);
  const dictationToRef = useRef(0);
  const listeningIntentRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const restartTimerRef = useRef<number | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      StoryLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: "story-link" },
      }),
      Placeholder.configure({
        placeholder: "Begin writing, or type / for commands…",
      }),
      ...(chapterEvents ? [ChapterEvent] : []),
    ],
    content,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "story-editor",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (readOnly) return;
      const html = currentEditor.getHTML();
      onChange(html);
      onEventMarkersChange?.(eventIdsInChapterHtml(html));
    },
    onSelectionUpdate: ({ editor: currentEditor, transaction }) => {
      if (transaction.docChanged) return;
      const { from, to, empty } = currentEditor.state.selection;
      onSelectionChange?.(
        empty ? "" : currentEditor.state.doc.textBetween(from, to, " "),
      );
      const { $from } = currentEditor.state.selection;
      const nearbyMarks = [
        ...$from.marks(),
        ...($from.nodeBefore?.marks ?? []),
        ...($from.nodeAfter?.marks ?? []),
      ];
      const href = nearbyMarks.find((mark) => mark.type.name === "link")?.attrs
        .href as string | undefined;
      const match = href?.match(/^#page-(.+)$/);
      onTagTargetChange(match?.[1] ?? null);
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getHTML() === content) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  useEffect(() => {
    if (!chapterEvents) return;
    return watchChapterEventDragScroll();
  }, [Boolean(chapterEvents)]);

  useEffect(() => {
    queueMicrotask(() =>
      setSpeechSupported(
        Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
      ),
    );
    return () => {
      listeningIntentRef.current = false;
      if (restartTimerRef.current != null) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      recognitionRef.current?.abort();
    };
  }, []);
  const formatState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      heading: currentEditor?.isActive("heading", { level: 2 }) ?? false,
      bulletList: currentEditor?.isActive("bulletList") ?? false,
      orderedList: currentEditor?.isActive("orderedList") ?? false,
      blockquote: currentEditor?.isActive("blockquote") ?? false,
    }),
  });

  const createPageFromEditorText = useCallback(
    (removeSlashCommand = false) => {
      if (!editor) return false;
      const { from, to, $from } = editor.state.selection;
      let title = "";
      let linkFrom = from;
      let linkTo = to;
      let removeFrom: number | null = null;

      if (removeSlashCommand) {
        if (from !== to) return false;
        const beforeCaret = $from.parent.textBetween(
          0,
          $from.parentOffset,
          " ",
        );
        if (!beforeCaret.endsWith("/page")) return false;
        const beforeCommand = beforeCaret.slice(0, -"/page".length);
        const match = beforeCommand.match(/[\p{L}\p{N}_'-]+(?=\s*$)/u);
        if (!match || match.index === undefined) return false;
        title = match[0];
        linkFrom = $from.start() + match.index;
        linkTo = linkFrom + title.length;
        removeFrom = linkTo;
      } else if (from !== to) {
        const selectedText = editor.state.doc.textBetween(from, to, " ");
        title = selectedText.trim();
        if (!title) return false;
        const leadingWhitespace = selectedText.indexOf(title);
        linkFrom = from + leadingWhitespace;
        linkTo = linkFrom + title.length;
      } else {
        const beforeCaret = $from.parent.textBetween(
          0,
          $from.parentOffset,
          " ",
        );
        const match = beforeCaret.match(/[\p{L}\p{N}_'-]+$/u);
        if (!match) return false;
        title = match[0];
        linkFrom = $from.pos - title.length;
        linkTo = $from.pos;
      }

      const linkedPage = onCreatePage(title, (href) => {
        const chain = editor.chain().focus();
        if (removeFrom !== null) {
          chain.deleteRange({ from: removeFrom, to });
        }
        chain
          .setTextSelection({ from: linkFrom, to: linkTo })
          .setLink({ href })
          .setTextSelection(linkTo)
          .run();
      });
      if (!linkedPage) return true;
      onTagTargetChange(linkedPage.id);
      return true;
    },
    [editor, onCreatePage, onTagTargetChange],
  );

  const openTagCommand = useCallback(
    (removeSlashCommand = false) => {
      if (!editor) return false;
      if (removeSlashCommand) {
        const { from, to, $from } = editor.state.selection;
        if (from !== to) return false;
        const beforeCaret = $from.parent.textBetween(
          0,
          $from.parentOffset,
          " ",
        );
        if (!/\/t$/u.test(beforeCaret)) return false;
        editor
          .chain()
          .focus()
          .deleteRange({ from: $from.pos - 2, to: $from.pos })
          .run();
      }
      onOpenTags(tagTarget?.id ?? null);
      return true;
    },
    [editor, onOpenTags, tagTarget?.id],
  );

  const openRelateCommand = useCallback(
    (removeSlashCommand = false) => {
      if (!editor) return false;
      if (removeSlashCommand) {
        const { from, to, $from } = editor.state.selection;
        if (from !== to) return false;
        const beforeCaret = $from.parent.textBetween(
          0,
          $from.parentOffset,
          " ",
        );
        if (!/\/r$/u.test(beforeCaret)) return false;
        editor
          .chain()
          .focus()
          .deleteRange({ from: $from.pos - 2, to: $from.pos })
          .run();
      }
      onOpenRelate(tagTarget?.id ?? null);
      return true;
    },
    [editor, onOpenRelate, tagTarget?.id],
  );

  const findExistingPageLinks = useCallback(
    (removeSlashCommand = false) => {
      if (!editor || isChapterEventDragging()) return false;
      const { from, to, $from } = editor.state.selection;
      if (removeSlashCommand) {
        if (from !== to) return false;
        const beforeCaret = $from.parent.textBetween(
          0,
          $from.parentOffset,
          " ",
        );
        if (!beforeCaret.endsWith("/link")) return false;
      }

      const pages = linkablePages.filter((page) => page.id !== currentPageId);
      const tr = editor.state.tr;
      if (removeSlashCommand) {
        tr.delete($from.pos - "/link".length, $from.pos);
      }

      const linkType = editor.schema.marks.link;
      const pending: { from: number; to: number; pageId: string }[] = [];
      tr.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        if (node.marks.some((mark) => mark.type === linkType)) return;
        for (const match of findPageTitleMatches(node.text, pages)) {
          pending.push({
            from: pos + match.from,
            to: pos + match.to,
            pageId: match.pageId,
          });
        }
      });

      for (const match of pending) {
        tr.addMark(
          match.from,
          match.to,
          linkType.create({ href: `#page-${match.pageId}` }),
        );
      }

      if (tr.docChanged) editor.view.dispatch(tr);
      else editor.chain().focus().run();
      onFindLinks(pending.length);
      return true;
    },
    [currentPageId, editor, linkablePages, onFindLinks],
  );

  useEffect(() => {
    if (!editor) return;
    const currentEditor = editor;
    const dom = currentEditor.view.dom;
    function onContextMenu(event: MouseEvent) {
      const pos = currentEditor.view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });
      if (!pos) return;
      const $pos = currentEditor.state.doc.resolve(pos.pos);
      const parentStart = $pos.start();
      const found = wordRangeAt($pos.parent.textContent, $pos.parentOffset);
      if (!found) return;
      event.preventDefault();
      setWordLookup(null);
      setWordLookupLoading(true);
      setWordMenu({
        from: parentStart + found.start,
        to: parentStart + found.end,
        word: found.word,
        x: event.clientX,
        y: event.clientY,
      });
    }
    dom.addEventListener("contextmenu", onContextMenu);
    return () => dom.removeEventListener("contextmenu", onContextMenu);
  }, [editor]);

  useEffect(() => {
    if (!wordMenu) return;
    const word = wordMenu.word;
    let cancelled = false;
    setWordLookupLoading(true);
    void lookupWord(word)
      .then((result) => {
        if (cancelled) return;
        setWordLookup(result);
        setWordLookupLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setWordLookup({ corrections: [], synonyms: [], related: [] });
        setWordLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wordMenu]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!editor) return;

      const noModifiers =
        !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
      if (
        editor.isFocused &&
        noModifiers &&
        !event.isComposing &&
        (event.key === "Enter" || event.key === " ") &&
        openTagCommand(true)
      ) {
        event.preventDefault();
        return;
      }
      if (
        editor.isFocused &&
        noModifiers &&
        !event.isComposing &&
        (event.key === "Enter" || event.key === " ") &&
        openRelateCommand(true)
      ) {
        event.preventDefault();
        return;
      }
      if (
        editor.isFocused &&
        noModifiers &&
        !event.isComposing &&
        (event.key === "Enter" || event.key === " ") &&
        findExistingPageLinks(true)
      ) {
        event.preventDefault();
        return;
      }
      if (
        editor.isFocused &&
        noModifiers &&
        !event.isComposing &&
        (event.key === "Enter" || event.key === " ") &&
        createPageFromEditorText(true)
      ) {
        event.preventDefault();
        return;
      }

      if (!event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        const { from, to } = editor.state.selection;
        onOpenAi(editor.state.doc.textBetween(from, to, " "));
        return;
      }

      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        openTagCommand();
        return;
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        openRelateCommand();
        return;
      }

      if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        findExistingPageLinks();
        return;
      }

      if (event.key.toLowerCase() !== "p") return;
      event.preventDefault();
      createPageFromEditorText();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    createPageFromEditorText,
    editor,
    findExistingPageLinks,
    onOpenAi,
    openRelateCommand,
    openTagCommand,
  ]);

  const chapterEventValue = useMemo(
    () => ({
      events: chapterEvents ?? [],
      onOpenEvent: onNavigatePage,
    }),
    [chapterEvents, onNavigatePage],
  );

  if (!editor) return <div className="editor-loading">Opening your page…</div>;
  const dictationEditor = editor;

  function stopDictationRestart() {
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }

  function finishDictation(status?: string) {
    listeningIntentRef.current = false;
    stopDictationRestart();
    recognitionRef.current = null;
    setListening(false);
    if (status) {
      setDictationStatus(status);
      return;
    }
    setDictationStatus((current) =>
      current.startsWith("Microphone") || current.startsWith("Dictation")
        ? current
        : "Dictation stopped.",
    );
  }

  function toggleDictation() {
    if (listening || listeningIntentRef.current) {
      listeningIntentRef.current = false;
      stopDictationRestart();
      recognitionRef.current?.stop();
      setDictationStatus("Finishing dictation…");
      return;
    }
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setDictationStatus(
        "Voice typing is not supported by this browser. Try Chrome or Edge.",
      );
      return;
    }
    const Engine: SpeechRecognitionConstructor = Recognition;

    function writeDictation(text: string) {
      const content = text ? `${text} ` : "";
      dictationEditor
        .chain()
        .focus()
        .command(({ tr, dispatch }) => {
          const size = tr.doc.content.size;
          const from = Math.min(Math.max(dictationFromRef.current, 0), size);
          const to = Math.min(Math.max(dictationToRef.current, from), size);
          if (dispatch) {
            tr.insertText(content, from, to);
            dictationToRef.current = from + content.length;
          }
          return true;
        })
        .run();
    }

    function attachRecognition(recognition: BrowserSpeechRecognition) {
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      recognition.onresult = (event) => {
        lastSpeechAtRef.current = Date.now();
        let committed = committedSpeechRef.current;
        let display = committed;
        let interimText = "";
        for (
          let index = event.resultIndex;
          index < event.results.length;
          index += 1
        ) {
          const result = event.results[index];
          const transcript = result[0].transcript.trim();
          if (!transcript) continue;
          if (result.isFinal) {
            committed = mergeDictationTranscript(committed, transcript);
            display = committed;
          } else {
            display = mergeDictationTranscript(committed, transcript);
            interimText = transcript;
          }
        }
        committedSpeechRef.current = committed;
        if (display) writeDictation(display);
        setDictationStatus(
          interimText.trim()
            ? `Listening: ${interimText.trim()}`
            : "Listening… speak naturally.",
        );
      };
      recognition.onerror = (event) => {
        if (event.error === "no-speech") return;
        if (event.error === "aborted" && listeningIntentRef.current) return;
        finishDictation(
          event.error === "not-allowed"
            ? "Microphone access was blocked. Allow it in your browser settings."
            : "Dictation stopped. Tap the microphone to try again.",
        );
      };
      recognition.onend = () => {
        if (
          shouldKeepDictationAlive(
            listeningIntentRef.current,
            lastSpeechAtRef.current,
            Date.now(),
          )
        ) {
          stopDictationRestart();
          restartTimerRef.current = window.setTimeout(() => {
            restartTimerRef.current = null;
            if (
              !shouldKeepDictationAlive(
                listeningIntentRef.current,
                lastSpeechAtRef.current,
                Date.now(),
              )
            ) {
              finishDictation();
              return;
            }
            try {
              recognition.start();
            } catch {
              const next = new Engine();
              attachRecognition(next);
              recognitionRef.current = next;
              try {
                next.start();
              } catch {
                finishDictation("The microphone could not be started.");
              }
            }
          }, 180);
          return;
        }
        finishDictation();
      };
    }

    const recognition = new Engine();
    committedSpeechRef.current = "";
    listeningIntentRef.current = true;
    lastSpeechAtRef.current = Date.now();
    const caret = dictationEditor.state.selection.from;
    dictationFromRef.current = caret;
    dictationToRef.current = caret;
    attachRecognition(recognition);
    recognitionRef.current = recognition;
    try {
      dictationEditor.chain().focus().run();
      recognition.start();
      setListening(true);
      setDictationStatus("Listening… speak naturally.");
    } catch {
      finishDictation("The microphone could not be started.");
    }
  }

  const tools = [
    {
      label: "Bold",
      icon: Bold,
      active: formatState?.bold ?? false,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: formatState?.italic ?? false,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Heading",
      icon: Heading2,
      active: formatState?.heading ?? false,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Bulleted list",
      icon: List,
      active: formatState?.bulletList ?? false,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: formatState?.orderedList ?? false,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      icon: Quote,
      active: formatState?.blockquote ?? false,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div className="editor-frame">
      {!readOnly && (
        <div className="editor-toolbar" aria-label="Text formatting">
        {tools.map(({ label, icon: Icon, active, run }) => (
          <button
            type="button"
            key={label}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={active ? "active" : ""}
            onMouseDown={(event) => event.preventDefault()}
            onClick={run}
          >
            <Icon size={16} />
          </button>
        ))}
        <span className="toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="page-create-button"
          title="Create a linked page from selected text or the previous word"
          aria-label="Create linked page"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => createPageFromEditorText()}
        >
          <FilePlus2 size={16} />
          <span>Page</span>
        </button>
        <button
          type="button"
          className="tag-create-button"
          title={
            tagTarget
              ? `Tag ${tagTarget.title}`
              : "Tag the most recently linked page"
          }
          aria-label={
            tagTarget
              ? `Tag ${tagTarget.title}`
              : "Tag the most recently linked page"
          }
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openTagCommand()}
        >
          <Tag size={16} />
          <span>Tag</span>
        </button>
        <button
          type="button"
          className="relate-create-button"
          title={
            tagTarget
              ? `Relate this page to ${tagTarget.title}`
              : "Relate the most recently linked page"
          }
          aria-label={
            tagTarget
              ? `Relate this page to ${tagTarget.title}`
              : "Relate the most recently linked page"
          }
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openRelateCommand()}
        >
          <GitFork size={16} />
          <span>Relate</span>
        </button>
        <button
          type="button"
          className="find-links-button"
          title="Find Links — wrap names on this page that already have pages"
          aria-label="Find Links"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => findExistingPageLinks()}
        >
          <Link2 size={16} />
          <span>Links</span>
        </button>
        <button
          type="button"
          className={`dictation-button ${listening ? "listening" : ""}`}
          title={
            speechSupported
              ? listening
                ? "Stop dictation"
                : "Start voice typing"
              : "Voice typing is unavailable in this browser"
          }
          aria-label={listening ? "Stop dictation" : "Start voice typing"}
          aria-pressed={listening}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleDictation}
        >
          {listening ? <MicOff size={16} /> : <Mic size={16} />}
          <span>{listening ? "Stop" : "Dictate"}</span>
        </button>
        {tagTarget && (
          <span className="tag-target-indicator" title="Current tag or relate target">
            Target: {tagTarget.title}
          </span>
        )}
        </div>
      )}
      {dictationStatus && (
        <div
          className={`dictation-status ${listening ? "listening" : ""}`}
          role="status"
          aria-live="polite"
        >
          {listening && <span className="dictation-pulse" />}
          {dictationStatus}
          {!listening && (
            <button type="button" onClick={() => setDictationStatus("")}>
              Dismiss
            </button>
          )}
        </div>
      )}
      <ChapterEventContext.Provider value={chapterEventValue}>
        <div
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const link = target.closest<HTMLAnchorElement>("a.story-link");
            const match = link?.getAttribute("href")?.match(/^#page-(.+)$/);
            if (!match) return;
            event.preventDefault();
            onNavigatePage(match[1]);
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </ChapterEventContext.Provider>
      {wordMenu && (
        <WordMenu
          word={wordMenu.word}
          x={wordMenu.x}
          y={wordMenu.y}
          loading={wordLookupLoading}
          lookup={wordLookup}
          onClose={() => setWordMenu(null)}
          onPick={(next) => {
            editor
              .chain()
              .focus()
              .insertContentAt(
                { from: wordMenu.from, to: wordMenu.to },
                matchCasing(wordMenu.word, next),
              )
              .run();
            setWordMenu(null);
          }}
        />
      )}
    </div>
  );
}
