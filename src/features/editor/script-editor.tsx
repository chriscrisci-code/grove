"use client";

import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextSelection } from "@tiptap/pm/state";
import {
  Clapperboard,
  FilePlus2,
  GitFork,
  Link2,
  MessageSquare,
  Mic,
  MicOff,
  Tag,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findPageTitleMatches } from "@/features/editor/find-page-links";
import {
  mergeDictationTranscript,
  shouldKeepDictationAlive,
} from "@/features/editor/dictation";
import {
  SCRIPT_ELEMENTS,
  SCRIPT_ELEMENT_LABELS,
  SCRIPT_ELEMENT_TITLES,
  applyScriptSlash,
  collectCharacterNamesFromHtml,
  cycleSluglinePrefix,
  filterCharacterSuggestions,
  isScriptHtmlEmpty,
  matchScriptSlashCommand,
  nextElementOnEnter,
  nextElementOnTab,
  normalizeScriptElement,
  type ScriptElement,
} from "@/features/editor/script-format";

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
  onend: ((event?: unknown) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function speechRecognitionEngine() {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

const ScriptParagraph = Paragraph.extend({
  addAttributes() {
    return {
      script: {
        default: "action",
        parseHTML: (element) =>
          normalizeScriptElement(element.getAttribute("data-script")),
        renderHTML: (attributes) => ({
          "data-script": normalizeScriptElement(attributes.script),
        }),
      },
    };
  },
});

const StoryLink = Link.extend({
  inclusive: false,
});

function currentElement(editor: Editor): ScriptElement {
  return normalizeScriptElement(editor.getAttributes("paragraph").script);
}

function currentBlockText(editor: Editor) {
  return editor.state.selection.$from.parent.textContent;
}

function replaceCurrentBlock(
  editor: Editor,
  text: string,
  element: ScriptElement,
  caret = text.length,
) {
  const { $from } = editor.state.selection;
  const from = $from.start();
  const to = $from.end();
  return editor
    .chain()
    .focus()
    .updateAttributes("paragraph", { script: element })
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.insertText(text, from, to);
        const pos = from + Math.max(0, Math.min(caret, text.length));
        tr.setSelection(TextSelection.create(tr.doc, pos));
      }
      return true;
    })
    .run();
}

function setCurrentElement(editor: Editor, element: ScriptElement) {
  return editor
    .chain()
    .focus()
    .updateAttributes("paragraph", { script: element })
    .run();
}

function splitToElement(editor: Editor, element: ScriptElement) {
  return editor
    .chain()
    .focus()
    .splitBlock()
    .updateAttributes("paragraph", { script: element })
    .run();
}

export function ScriptEditor({
  content,
  onChange,
  onCreatePage,
  onOpenAi,
  tagTarget,
  onTagTargetChange,
  onOpenTags,
  onOpenRelate,
  onNavigatePage,
  linkablePages,
  characterNames,
  currentPageId,
  onFindLinks,
  onRequestImport,
  readOnly = false,
  onSelectionChange,
}: {
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
  linkablePages: { id: string; title: string; aliases?: string[] }[];
  characterNames: string[];
  currentPageId: string;
  onFindLinks: (count: number) => void;
  onRequestImport: () => void;
  readOnly?: boolean;
  onSelectionChange?: (text: string) => void;
}) {
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [dictationStatus, setDictationStatus] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [started, setStarted] = useState(!isScriptHtmlEmpty(content));
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const committedSpeechRef = useRef("");
  const dictationFromRef = useRef(0);
  const dictationToRef = useRef(0);
  const listeningIntentRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const restartTimerRef = useRef<number | null>(null);
  const keyHandlerRef = useRef<(event: KeyboardEvent) => boolean>(() => false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        link: false,
      }),
      ScriptParagraph,
      StoryLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: "story-link" },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          const kind = normalizeScriptElement(node.attrs.script);
          if (kind === "scene") return "INT. LOCATION - DAY";
          if (kind === "character") return "CHARACTER NAME";
          if (kind === "dialogue") return "Dialogue…";
          if (kind === "parenthetical") return "(beat)";
          if (kind === "transition") return "CUT TO:";
          return "Action…  Tab for a character, /int for a scene";
        },
      }),
    ],
    content,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "script-editor",
        spellcheck: "true",
      },
      handleKeyDown: (_view, event) =>
        keyHandlerRef.current(event as unknown as KeyboardEvent),
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (!readOnly) onChange(currentEditor.getHTML());
    },
    onSelectionUpdate: ({ editor: currentEditor, transaction }) => {
      if (transaction.docChanged) return;
      const { from, to, empty } = currentEditor.state.selection;
      onSelectionChange?.(
        empty ? "" : currentEditor.state.doc.textBetween(from, to, " "),
      );
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    queueMicrotask(() => setSpeechSupported(Boolean(speechRecognitionEngine())));
    return () => {
      listeningIntentRef.current = false;
      if (restartTimerRef.current != null) {
        window.clearTimeout(restartTimerRef.current);
      }
      recognitionRef.current?.abort();
    };
  }, []);

  const elementState = normalizeScriptElement(
    useEditorState({
      editor,
      selector: ({ editor: currentEditor }) =>
        currentEditor?.getAttributes("paragraph").script as string | undefined,
    }),
  );

  const recentCharacters = useMemo(
    () => (editor ? collectCharacterNamesFromHtml(editor.getHTML()) : []),
    [editor, editor?.state.doc],
  );
  const characterQuery =
    editor && currentElement(editor) === "character" ? currentBlockText(editor) : "";
  const suggestions = useMemo(
    () =>
      filterCharacterSuggestions(
        pickerOpen || (editor && currentElement(editor) === "character")
          ? characterQuery
          : "",
        characterNames,
        recentCharacters,
      ),
    [characterNames, characterQuery, editor, pickerOpen, recentCharacters],
  );

  const showEmptyStart = !readOnly && !started && isScriptHtmlEmpty(content);

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
        const beforeCaret = $from.parent.textBetween(0, $from.parentOffset, " ");
        if (!beforeCaret.endsWith("/page")) return false;
        const beforeCommand = beforeCaret.slice(0, -"/page".length);
        const match = beforeCommand.match(/[\p{L}\p{N}_'-]+(?=\s*$)/u);
        if (!match || match.index === undefined) return false;
        title = match[0];
        linkFrom = $from.start() + match.index;
        linkTo = linkFrom + title.length;
        removeFrom = linkTo;
      } else if (from !== to) {
        const selectedText = editor.state.doc.textBetween(from, to, " ").trim();
        if (!selectedText) return false;
        title = selectedText;
      } else {
        const beforeCaret = $from.parent.textBetween(0, $from.parentOffset, " ");
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
        const beforeCaret = $from.parent.textBetween(0, $from.parentOffset, " ");
        if (!/\/t$/u.test(beforeCaret)) return false;
        editor.chain().focus().deleteRange({ from: $from.pos - 2, to: $from.pos }).run();
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
        const beforeCaret = $from.parent.textBetween(0, $from.parentOffset, " ");
        if (!/\/r$/u.test(beforeCaret)) return false;
        editor.chain().focus().deleteRange({ from: $from.pos - 2, to: $from.pos }).run();
      }
      onOpenRelate(tagTarget?.id ?? null);
      return true;
    },
    [editor, onOpenRelate, tagTarget?.id],
  );

  const findExistingPageLinks = useCallback(
    (removeSlashCommand = false) => {
      if (!editor) return false;
      const { from, to, $from } = editor.state.selection;
      if (removeSlashCommand) {
        if (from !== to) return false;
        const beforeCaret = $from.parent.textBetween(0, $from.parentOffset, " ");
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

  const applySlashIfPresent = useCallback(() => {
    if (!editor) return false;
    const { from, to, $from } = editor.state.selection;
    if (from !== to) return false;
    const beforeCaret = $from.parent.textBetween(0, $from.parentOffset, " ");
    if (matchScriptSlashCommand(beforeCaret)?.token === "/page") return false;
    const result = applyScriptSlash(beforeCaret, currentElement(editor));
    if (!result) return false;
    replaceCurrentBlock(editor, result.text, result.element, result.caret);
    setStarted(true);
    if (result.openCharacterPicker) {
      setPickerOpen(true);
      setPickerIndex(0);
    }
    return true;
  }, [editor]);

  const pickCharacter = useCallback(
    (name: string, thenDialogue = false) => {
      if (!editor) return;
      const page = linkablePages.find(
        (item) => item.title.toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      const cue = name.toUpperCase();
      replaceCurrentBlock(editor, cue, "character");
      if (page) {
        const from = editor.state.selection.$from.start();
        const to = from + cue.length;
        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .setLink({ href: `#page-${page.id}` })
          .setTextSelection(to)
          .run();
        onTagTargetChange(page.id);
      }
      setPickerOpen(false);
      if (thenDialogue) splitToElement(editor, "dialogue");
    },
    [editor, linkablePages, onTagTargetChange],
  );

  const handleScriptKey = useCallback(
    (event: KeyboardEvent) => {
      if (!editor || readOnly || !editor.isFocused || event.isComposing) {
        return false;
      }

      const noMods =
        !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
      const showingPicker =
        (pickerOpen || currentElement(editor) === "character") &&
        suggestions.length > 0;

      if (showingPicker && event.key === "ArrowDown" && noMods) {
        event.preventDefault();
        setPickerOpen(true);
        setPickerIndex((index) => (index + 1) % suggestions.length);
        return true;
      }
      if (showingPicker && event.key === "ArrowUp" && noMods) {
        event.preventDefault();
        setPickerOpen(true);
        setPickerIndex(
          (index) => (index - 1 + suggestions.length) % suggestions.length,
        );
        return true;
      }
      if (showingPicker && event.key === "Escape") {
        setPickerOpen(false);
        return true;
      }

      if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setStarted(true);
        if (showingPicker && !event.shiftKey) {
          pickCharacter(suggestions[pickerIndex] ?? suggestions[0]);
          return true;
        }
        const kind = currentElement(editor);
        if (kind === "scene") {
          const next = cycleSluglinePrefix(currentBlockText(editor));
          replaceCurrentBlock(editor, next.text, "scene", next.caret);
          return true;
        }
        const next = nextElementOnTab(kind);
        if (currentBlockText(editor).trim()) {
          splitToElement(editor, next);
        } else {
          setCurrentElement(editor, next);
        }
        if (next === "character") {
          setPickerOpen(true);
          setPickerIndex(0);
        }
        return true;
      }

      if (
        (event.key === "Enter" || event.key === " ") &&
        noMods &&
        (openTagCommand(true) ||
          openRelateCommand(true) ||
          findExistingPageLinks(true) ||
          createPageFromEditorText(true) ||
          applySlashIfPresent())
      ) {
        event.preventDefault();
        return true;
      }

      if (event.key === "Enter" && noMods) {
        event.preventDefault();
        setStarted(true);
        if (showingPicker) {
          pickCharacter(suggestions[pickerIndex] ?? suggestions[0], true);
          return true;
        }
        splitToElement(editor, nextElementOnEnter(currentElement(editor)));
        return true;
      }

      if (!event.altKey || event.ctrlKey || event.metaKey) return false;

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        const { from, to } = editor.state.selection;
        onOpenAi(editor.state.doc.textBetween(from, to, " "));
        return true;
      }
      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        openTagCommand();
        return true;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        openRelateCommand();
        return true;
      }
      if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        findExistingPageLinks();
        return true;
      }
      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        setStarted(true);
        if (currentBlockText(editor).trim()) {
          splitToElement(editor, "character");
        } else {
          setCurrentElement(editor, "character");
        }
        setPickerOpen(true);
        setPickerIndex(0);
        return true;
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        setStarted(true);
        if (!currentBlockText(editor).trim()) {
          const next = cycleSluglinePrefix("");
          replaceCurrentBlock(editor, next.text, "scene", next.caret);
        } else {
          setCurrentElement(editor, "scene");
        }
        return true;
      }
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        createPageFromEditorText();
        return true;
      }
      return false;
    },
    [
      applySlashIfPresent,
      createPageFromEditorText,
      editor,
      findExistingPageLinks,
      onOpenAi,
      openRelateCommand,
      openTagCommand,
      pickCharacter,
      pickerIndex,
      pickerOpen,
      readOnly,
      suggestions,
    ],
  );

  useEffect(() => {
    keyHandlerRef.current = handleScriptKey;
  }, [handleScriptKey]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!editor?.isFocused) return;
      if (event.altKey && event.key.toLowerCase() === "s") {
        handleScriptKey(event);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, handleScriptKey]);

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
    const Recognition = speechRecognitionEngine();
    if (!Recognition) {
      setDictationStatus(
        "Voice typing is not supported by this browser. Try Chrome or Edge.",
      );
      return;
    }
    const Engine: SpeechRecognitionConstructor = Recognition;

    function writeDictation(text: string) {
      const contentText = text ? `${text} ` : "";
      dictationEditor
        .chain()
        .focus()
        .command(({ tr, dispatch }) => {
          const size = tr.doc.content.size;
          const from = Math.min(Math.max(dictationFromRef.current, 0), size);
          const to = Math.min(Math.max(dictationToRef.current, from), size);
          if (dispatch) {
            tr.insertText(contentText, from, to);
            dictationToRef.current = from + contentText.length;
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

  function startWriting() {
    if (!editor) return;
    setStarted(true);
    const next = cycleSluglinePrefix("");
    replaceCurrentBlock(editor, next.text, "scene", next.caret);
  }

  const showPicker =
    !readOnly &&
    (pickerOpen || currentElement(editor) === "character") &&
    suggestions.length > 0;

  return (
    <div className="editor-frame">
      {!readOnly && (
        <div className="editor-toolbar" aria-label="Script formatting">
          {SCRIPT_ELEMENTS.map((element) => (
            <button
              type="button"
              key={element}
              title={SCRIPT_ELEMENT_TITLES[element]}
              aria-label={SCRIPT_ELEMENT_TITLES[element]}
              aria-pressed={elementState === element}
              className={`script-element-button ${
                elementState === element ? "active" : ""
              }`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setStarted(true);
                setCurrentElement(editor, element);
                if (element === "character") {
                  setPickerOpen(true);
                  setPickerIndex(0);
                }
              }}
            >
              {element === "scene" ? (
                <Clapperboard size={14} />
              ) : element === "character" ? (
                <UserRound size={14} />
              ) : element === "dialogue" ? (
                <MessageSquare size={14} />
              ) : null}
              <span>{SCRIPT_ELEMENT_LABELS[element]}</span>
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
          <span className="script-element-indicator">
            {SCRIPT_ELEMENT_TITLES[elementState].toUpperCase()}
          </span>
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
      {showPicker && (
        <div className="script-character-picker" role="listbox" aria-label="Character names">
          {suggestions.map((name, index) => (
            <button
              type="button"
              key={name}
              role="option"
              aria-selected={index === pickerIndex}
              className={index === pickerIndex ? "active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pickCharacter(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {showEmptyStart && (
        <div className="script-empty-start">
          <p>Start in script format, or bring a chapter over as a first pass.</p>
          <div>
            <button type="button" onClick={startWriting}>
              Start writing
            </button>
            <button type="button" className="secondary-button" onClick={onRequestImport}>
              Import a chapter
            </button>
          </div>
        </div>
      )}
      <div
        className={showEmptyStart ? "script-editor-host dimmed" : "script-editor-host"}
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
    </div>
  );
}
