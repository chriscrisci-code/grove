"use client";

import { Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { layoutFamilyTree } from "@/features/relationships/family";
import type {
  FamilyRelationshipKind,
  PageType,
  StoryRelationship,
} from "@/features/workspace/page-types";

type FamilyPage = {
  id: string;
  title: string;
  pageType: PageType;
};

type FamilyChoice =
  | FamilyRelationshipKind
  | "child_of"
  | "adopted_by";

export function RelationshipFamily({
  pages,
  relationships,
  onOpenPage,
  onCreateRelationship,
  onDeleteRelationship,
}: {
  pages: FamilyPage[];
  relationships: StoryRelationship[];
  onOpenPage: (pageId: string) => void;
  onCreateRelationship: (
    fromPageId: string,
    toPageId: string,
    kind: FamilyRelationshipKind,
  ) => void;
  onDeleteRelationship: (id: string) => void;
}) {
  const characters = pages.filter((page) => page.pageType === "character");
  const [fromId, setFromId] = useState(characters[0]?.id ?? "");
  const [toId, setToId] = useState(characters[1]?.id ?? "");
  const [choice, setChoice] = useState<FamilyChoice>("parent_of");
  const layout = useMemo(
    () => layoutFamilyTree(pages, relationships),
    [pages, relationships],
  );
  const byId = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes],
  );

  function addRelationship() {
    if (!fromId || !toId || fromId === toId) return;
    if (choice === "child_of") {
      onCreateRelationship(toId, fromId, "parent_of");
      return;
    }
    if (choice === "adopted_by") {
      onCreateRelationship(toId, fromId, "adoptive_parent_of");
      return;
    }
    onCreateRelationship(fromId, toId, choice);
  }

  return (
    <div className="family-view">
      <div className="family-toolbar">
        <Users size={16} />
        <select
          value={fromId}
          aria-label="First character"
          onChange={(event) => setFromId(event.target.value)}
        >
          <option value="">Choose character</option>
          {characters.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title || "Untitled"}
            </option>
          ))}
        </select>
        <select
          value={choice}
          aria-label="Family relationship"
          onChange={(event) => setChoice(event.target.value as FamilyChoice)}
        >
          <option value="parent_of">is parent of</option>
          <option value="child_of">is child of</option>
          <option value="adoptive_parent_of">is adoptive parent of</option>
          <option value="adopted_by">is adopted by</option>
          <option value="partner">is partner of</option>
          <option value="former_partner">is former partner of</option>
        </select>
        <select
          value={toId}
          aria-label="Second character"
          onChange={(event) => setToId(event.target.value)}
        >
          <option value="">Choose character</option>
          {characters.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title || "Untitled"}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="primary-button"
          disabled={!fromId || !toId || fromId === toId}
          onClick={addRelationship}
        >
          Add to tree
        </button>
      </div>

      {characters.length < 2 ? (
        <p className="relationship-empty">
          Create at least two Character pages to build a family tree.
        </p>
      ) : layout.edges.length === 0 ? (
        <p className="relationship-empty">
          Choose two characters above and add their first family relationship.
        </p>
      ) : (
        <div className="family-canvas-wrap">
          <svg
            className="family-canvas"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            style={{ minWidth: layout.width, minHeight: layout.height }}
            role="img"
            aria-label="Family tree"
          >
            {layout.edges.map((edge) => {
              const from = byId.get(edge.fromPageId);
              const to = byId.get(edge.toPageId);
              if (!from || !to) return null;
              const partner =
                edge.kind === "partner" || edge.kind === "former_partner";
              const path = partner
                ? `M ${from.x} ${from.y} L ${to.x} ${to.y}`
                : `M ${from.x} ${from.y + 25} V ${(from.y + to.y) / 2} H ${to.x} V ${to.y - 25}`;
              return (
                <path
                  key={edge.id}
                  d={path}
                  className={`family-edge family-edge-${edge.kind.replaceAll("_", "-")}`}
                />
              );
            })}
            {layout.nodes.map((node) => (
              <g
                key={node.id}
                className="family-node"
                transform={`translate(${node.x} ${node.y})`}
                role="button"
                tabIndex={0}
                onClick={() => onOpenPage(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    onOpenPage(node.id);
                  }
                }}
              >
                <rect x="-70" y="-25" width="140" height="50" rx="10" />
                <text y="4">{(node.title || "Untitled").slice(0, 20)}</text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {layout.edges.length > 0 && (
        <div className="family-relationships">
          {layout.edges.map((edge) => (
            <span key={edge.id}>
              {byId.get(edge.fromPageId)?.title || "Untitled"} {edge.label}{" "}
              {byId.get(edge.toPageId)?.title || "Untitled"}
              <button
                type="button"
                aria-label="Remove family relationship"
                onClick={() => onDeleteRelationship(edge.id)}
              >
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
