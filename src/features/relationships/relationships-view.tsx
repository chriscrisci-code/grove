"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { RelationshipTimeline } from "@/features/relationships/relationship-timeline";
import { RelationshipWeb } from "@/features/relationships/relationship-web";
import type { TimelineSourcePage } from "@/features/relationships/timeline";
import type { StoryRelationship } from "@/features/workspace/page-types";

type RelationshipsViewProps = {
  pages: TimelineSourcePage[];
  relationships: StoryRelationship[];
  workspaceId?: string;
  onOpenPage: (pageId: string) => void;
  onClose: () => void;
  onCreateEvent: (y: number, lane: number) => string | null;
  onUpdatePage: (
    pageId: string,
    patch: { title?: string; fields?: Record<string, string> },
  ) => void;
};

export function RelationshipsView({
  pages,
  relationships,
  workspaceId,
  onOpenPage,
  onClose,
  onCreateEvent,
  onUpdatePage,
}: RelationshipsViewProps) {
  const [view, setView] = useState<"web" | "timeline">("timeline");

  return (
    <div className="relationship-web">
      <header className="relationship-web-heading">
        <div>
          <span className="eyebrow">RELATIONSHIPS</span>
          <div className="relationship-view-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === "timeline"}
              onClick={() => setView("timeline")}
            >
              Timeline
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "web"}
              onClick={() => setView("web")}
            >
              Web
            </button>
          </div>
        </div>
        <button type="button" className="research-close" onClick={onClose}>
          <X size={16} />
          Writing
        </button>
      </header>
      {view === "web" ? (
        <RelationshipWeb
          pages={pages}
          relationships={relationships}
          onOpenPage={onOpenPage}
          onUpdatePage={onUpdatePage}
        />
      ) : (
        <RelationshipTimeline
          pages={pages}
          workspaceId={workspaceId}
          onOpenPage={onOpenPage}
          onCreateEvent={onCreateEvent}
          onUpdatePage={onUpdatePage}
        />
      )}
    </div>
  );
}
