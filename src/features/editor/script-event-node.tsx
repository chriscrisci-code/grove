"use client";

import { Node } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { Clapperboard } from "lucide-react";
import { createContext, useContext } from "react";
import { SCRIPT_EVENT_TYPE } from "@/features/editor/script-events";

export type ScriptEventInfo = {
  id: string;
  title: string;
  content: string;
};

export const ScriptEventContext = createContext<{
  events: ScriptEventInfo[];
  onOpenEvent: (id: string) => void;
}>({
  events: [],
  onOpenEvent: () => undefined,
});

function ScriptEventView({ node }: ReactNodeViewProps<HTMLDivElement>) {
  const eventId = String(node.attrs.eventId ?? "");
  const { events, onOpenEvent } = useContext(ScriptEventContext);
  const event = events.find((item) => item.id === eventId);
  const title = event?.title?.trim() || "Untitled";
  const body = event?.content?.trim() || "";

  return (
    <NodeViewWrapper
      as="div"
      className="chapter-event-block script-event-block"
      data-type={SCRIPT_EVENT_TYPE}
      data-event-id={eventId}
      data-drag-handle
      draggable="true"
      contentEditable={false}
      aria-label={`Move ${title}`}
      title="Drag to move this script event between lines"
    >
      <span className="chapter-event-handle" aria-hidden="true">
        <Clapperboard size={16} />
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
        {body && body !== "<p></p>" && body !== '<p data-script="action"></p>' ? (
          <div
            className="chapter-event-text script-body"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <p className="chapter-event-empty">No script event text yet.</p>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ScriptEvent = Node.create({
  name: "scriptEvent",
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
    return [{ tag: `div[data-type="${SCRIPT_EVENT_TYPE}"]` }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        "data-type": SCRIPT_EVENT_TYPE,
        ...HTMLAttributes,
      },
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ScriptEventView);
  },
});
