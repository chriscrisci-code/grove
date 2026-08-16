"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Mic,
  MicOff,
  Quote,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

type StoryEditorProps = {
  content: string;
  onChange: (html: string) => void;
  onCreatePage: (title: string, linkSelection: (href: string) => void) => void;
  onOpenAi: (selection: string) => void;
};

export function StoryEditor({
  content,
  onChange,
  onCreatePage,
  onOpenAi,
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
      Link.configure({
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

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!editor || !event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        const { from, to } = editor.state.selection;
        onOpenAi(editor.state.doc.textBetween(from, to, " "));
        return;
      }

      if (event.key.toLowerCase() !== "p") return;
      event.preventDefault();
      const { $from } = editor.state.selection;
      const beforeCaret = $from.parent.textBetween(0, $from.parentOffset, " ");
      const match = beforeCaret.match(/[\p{L}\p{N}_'-]+$/u);
      if (!match) return;

      const title = match[0];
      const from = $from.pos - title.length;
      const to = $from.pos;
      onCreatePage(title, (href) => {
        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .setLink({ href })
          .setTextSelection(to)
          .run();
      });
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [editor, onCreatePage, onOpenAi]);

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
      <EditorContent editor={editor} />
    </div>
  );
}
