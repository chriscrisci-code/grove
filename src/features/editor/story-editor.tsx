"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  FilePlus2,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Mic,
  MicOff,
  Quote,
  Tag,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  ) => { id: string; title: string };
  onOpenAi: (selection: string) => void;
  tagTarget: { id: string; title: string } | null;
  onTagTargetChange: (pageId: string | null) => void;
  onOpenTags: (pageId: string | null) => void;
  onNavigatePage: (pageId: string) => void;
};

export function StoryEditor({
  content,
  onChange,
  onCreatePage,
  onOpenAi,
  tagTarget,
  onTagTargetChange,
  onOpenTags,
  onNavigatePage,
}: StoryEditorProps) {
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [dictationStatus, setDictationStatus] = useState("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const committedSpeechRef = useRef(
    new Map<number, { text: string; committedAt: number }>(),
  );
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
    ],
    content,
    editorProps: {
      attributes: {
        class: "story-editor",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
    onSelectionUpdate: ({ editor: currentEditor, transaction }) => {
      if (transaction.docChanged) return;
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
    queueMicrotask(() =>
      setSpeechSupported(
        Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
      ),
    );
    return () => recognitionRef.current?.abort();
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

      if (event.key.toLowerCase() !== "p") return;
      event.preventDefault();
      createPageFromEditorText();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [createPageFromEditorText, editor, onOpenAi, openTagCommand]);

  if (!editor) return <div className="editor-loading">Opening your page…</div>;
  const dictationEditor = editor;

  function toggleDictation() {
    if (listening) {
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

    const recognition = new Recognition();
    committedSpeechRef.current.clear();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const finalSegments: string[] = [];
      let interimText = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const transcript = result[0].transcript.trim();
        if (result.isFinal && transcript) {
          const previous = committedSpeechRef.current.get(index);
          const duplicate =
            previous?.text.toLocaleLowerCase() ===
              transcript.toLocaleLowerCase() &&
            Date.now() - previous.committedAt < 10_000;
          if (!duplicate) {
            finalSegments.push(transcript);
            committedSpeechRef.current.set(index, {
              text: transcript,
              committedAt: Date.now(),
            });
          }
        } else {
          interimText += transcript;
        }
      }
      if (finalSegments.length) {
        dictationEditor
          .chain()
          .focus()
          .insertContent(`${finalSegments.join(" ")} `)
          .run();
      }
      setDictationStatus(
        interimText.trim()
          ? `Listening: ${interimText.trim()}`
          : "Listening… speak naturally.",
      );
    };
    recognition.onerror = (event) => {
      setListening(false);
      setDictationStatus(
        event.error === "not-allowed"
          ? "Microphone access was blocked. Allow it in your browser settings."
          : "Dictation stopped. Tap the microphone to try again.",
      );
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      setDictationStatus((current) =>
        current.startsWith("Microphone") || current.startsWith("Dictation")
          ? current
          : "Dictation stopped.",
      );
    };

    recognitionRef.current = recognition;
    try {
      dictationEditor.chain().focus().run();
      recognition.start();
      setListening(true);
      setDictationStatus("Listening… speak naturally.");
    } catch {
      setListening(false);
      setDictationStatus("The microphone could not be started.");
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
          <span className="tag-target-indicator" title="Current tag target">
            Tag target: {tagTarget.title}
          </span>
        )}
      </div>
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
    </div>
  );
}
