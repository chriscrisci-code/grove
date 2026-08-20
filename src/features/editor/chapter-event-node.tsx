/* eslint-disable @next/next/no-img-element */
"use client";

import { Node } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { Clock3 } from "lucide-react";
import { createContext, useContext } from "react";
import { CHAPTER_EVENT_TYPE } from "@/features/editor/chapter-events";

export type ChapterEventInfo = {
  id: string;
  title: string;
  content: string;
};

export const ChapterEventContext = createContext<{
  events: ChapterEventInfo[];
  onOpenEvent: (id: string) => void;
}>({
  events: [],
  onOpenEvent: () => undefined,
});

function ChapterEventView({ node }: ReactNodeViewProps<HTMLDivElement>) {
  const eventId = String(node.attrs.eventId ?? "");
  const { events, onOpenEvent } = useContext(ChapterEventContext);
  const event = events.find((item) => item.id === eventId);
  const title = event?.title?.trim() || "Untitled";
  const body = event?.content?.trim() || "";

  return (
    <NodeViewWrapper
      as="div"
      className="chapter-event-block"
      data-type={CHAPTER_EVENT_TYPE}
      data-event-id={eventId}
      data-drag-handle
      draggable="true"
      contentEditable={false}
      aria-label={`Move ${title}`}
      title="Drag to move this event between paragraphs"
    >
      <span className="chapter-event-handle" aria-hidden="true">
        <Clock3 size={16} />
      </span>
      <div className="chapter-event-copy">
        <span
          className="chapter-event-title"
          role="link"
          tabIndex={0}
          onClick={() => event && onOpenEvent(event.id)}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") {
              return;
            }
            keyboardEvent.preventDefault();
            if (event) onOpenEvent(event.id);
          }}
        >
          {title}
        </span>
        {body && body !== "<p></p>" ? (
          <div
            className="chapter-event-text"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <p className="chapter-event-empty">No event text yet.</p>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ChapterEvent = Node.create({
  name: "chapterEvent",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      eventId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-event-id"),
        renderHTML: (attributes) =>
          attributes.eventId ? { "data-event-id": attributes.eventId } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: `div[data-type="${CHAPTER_EVENT_TYPE}"]` }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        "data-type": CHAPTER_EVENT_TYPE,
        ...HTMLAttributes,
      },
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ChapterEventView);
  },
});
