"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, List, ListOrdered, Quote } from "lucide-react";
import { useEffect } from "react";

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
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
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

  const tools = [
    {
      label: "Bold",
      icon: Bold,
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Heading",
      icon: Heading2,
      active: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Bulleted list",
      icon: List,
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      icon: Quote,
      active: editor.isActive("blockquote"),
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
            onClick={run}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
