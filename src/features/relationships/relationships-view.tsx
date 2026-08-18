"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { RelationshipTimeline } from "@/features/relationships/relationship-timeline";
import { RelationshipWeb } from "@/features/relationships/relationship-web";
import { RelationshipFamily } from "@/features/relationships/relationship-family";
import { RelationshipGeography } from "@/features/relationships/relationship-geography";
import type { GeographyDocument } from "@/features/relationships/geography";
import type { TimelineSourcePage } from "@/features/relationships/timeline";
import type {
  FamilyRelationshipKind,
  StoryRelationship,
} from "@/features/workspace/page-types";

const GEOGRAPHY_ENABLED = false;

type RelationshipsViewProps = {
  pages: TimelineSourcePage[];
  relationships: StoryRelationship[];
  geography: GeographyDocument;
  geographyBackgroundUrl: string | null;
  workspaceId?: string;
  onOpenPage: (pageId: string) => void;
  onClose: () => void;
  onCreateEvent: (y: number, lane: number) => string | null;
  onCreateFamilyRelationship: (
    fromPageId: string,
    toPageId: string,
    kind: FamilyRelationshipKind,
  ) => void;
  onDeleteRelationship: (id: string) => void;
  onGeographyChange: (document: GeographyDocument) => void;
  onUploadGeographyBackground: (file: File) => void;
  onRemoveGeographyBackground: () => void;
  onUpdatePage: (
    pageId: string,
    patch: { title?: string; fields?: Record<string, string> },
  ) => void;
};

export function RelationshipsView({
  pages,
  relationships,
  geography,
  geographyBackgroundUrl,
  workspaceId,
  onOpenPage,
  onClose,
  onCreateEvent,
  onCreateFamilyRelationship,
  onDeleteRelationship,
  onGeographyChange,
  onUploadGeographyBackground,
  onRemoveGeographyBackground,
  onUpdatePage,
}: RelationshipsViewProps) {
  const [view, setView] = useState<
    "web" | "timeline" | "family" | "geography"
  >("timeline");

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
            <button
              type="button"
              role="tab"
              aria-selected={view === "family"}
              onClick={() => setView("family")}
            >
              Family
            </button>
            {GEOGRAPHY_ENABLED && (
              <button
                type="button"
                role="tab"
                aria-selected={view === "geography"}
                onClick={() => setView("geography")}
              >
                Geography
              </button>
            )}
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
      ) : view === "family" ? (
        <RelationshipFamily
          pages={pages}
          relationships={relationships}
          onOpenPage={onOpenPage}
          onCreateRelationship={onCreateFamilyRelationship}
          onDeleteRelationship={onDeleteRelationship}
        />
      ) : view === "geography" ? (
        <RelationshipGeography
          document={geography}
          backgroundUrl={geographyBackgroundUrl}
          pages={pages}
          onChange={onGeographyChange}
          onOpenPage={onOpenPage}
          onUploadBackground={onUploadGeographyBackground}
          onRemoveBackground={onRemoveGeographyBackground}
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
