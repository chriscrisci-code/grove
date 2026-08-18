"use client";

import {
  Check,
  Eye,
  EyeOff,
  Hand,
  ImagePlus,
  Lock,
  MapPin,
  MousePointer2,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  TERRAIN_PRESETS,
  constrainGeographyAngle,
  pointsAttribute,
  polygonCentroid,
  type GeographyDocument,
  type GeographyLayer,
  type GeographyPoint,
  type GeographyTool,
  type TerrainPreset,
} from "@/features/relationships/geography";
import type { PageType } from "@/features/workspace/page-types";

type GeographyPage = {
  id: string;
  title: string;
  pageType: PageType;
};

const TOOL_LABELS: Array<{ tool: GeographyTool; label: string }> = [
  { tool: "pan", label: "Pan" },
  { tool: "select", label: "Select" },
  { tool: "terrain", label: "Terrain" },
  { tool: "border", label: "Border" },
  { tool: "region", label: "Region" },
  { tool: "route", label: "Route" },
];

function layerDefaults(
  kind: GeographyLayer["kind"],
  terrain: TerrainPreset,
): GeographyLayer["style"] {
  const preset = TERRAIN_PRESETS[terrain];
  if (kind === "terrain") {
    return {
      fill: preset.fill,
      stroke: preset.fill,
      strokeWidth: 1.5,
      opacity: preset.opacity,
      terrain,
    };
  }
  if (kind === "route") {
    return {
      fill: "#000000",
      stroke: "#9a5f3f",
      strokeWidth: 4,
      opacity: 0.9,
      dash: "10 7",
    };
  }
  if (kind === "border") {
    return {
      fill: "#000000",
      stroke: "#526357",
      strokeWidth: 3,
      opacity: 0.9,
      dash: "5 4",
    };
  }
  return {
    fill: "#d9d2b8",
    stroke: "#6f765f",
    strokeWidth: 2,
    opacity: 0.62,
  };
}

export function RelationshipGeography({
  document,
  backgroundUrl,
  pages,
  onChange,
  onOpenPage,
  onUploadBackground,
  onRemoveBackground,
}: {
  document: GeographyDocument;
  backgroundUrl: string | null;
  pages: GeographyPage[];
  onChange: (document: GeographyDocument) => void;
  onOpenPage: (pageId: string) => void;
  onUploadBackground: (file: File) => void;
  onRemoveBackground: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const panRef = useRef<{
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const vertexRef = useRef<{
    layerId: string;
    index: number;
  } | null>(null);
  const [tool, setTool] = useState<GeographyTool>("pan");
  const [terrain, setTerrain] = useState<TerrainPreset>("forest");
  const [draft, setDraft] = useState<GeographyPoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const locations = useMemo(
    () => pages.filter((page) => page.pageType === "location"),
    [pages],
  );
  const selected =
    document.layers.find((layer) => layer.id === selectedId) ?? null;

  function canvasPoint(clientX: number, clientY: number): GeographyPoint {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const screenX =
      ((clientX - rect.left) / Math.max(1, rect.width)) * document.canvas.width;
    const screenY =
      ((clientY - rect.top) / Math.max(1, rect.height)) *
      document.canvas.height;
    return [(screenX - offset.x) / zoom, (screenY - offset.y) / zoom];
  }

  function updateLayer(layerId: string, patch: Partial<GeographyLayer>) {
    onChange({
      ...document,
      layers: document.layers.map((layer) =>
        layer.id === layerId ? { ...layer, ...patch } : layer,
      ),
    });
  }

  function chooseTool(next: GeographyTool) {
    setTool(next);
    setDraft([]);
  }

  function finishDraft() {
    const kind =
      tool === "terrain" ||
      tool === "border" ||
      tool === "region" ||
      tool === "route"
        ? tool
        : null;
    if (!kind) return;
    const minimum = kind === "terrain" || kind === "region" ? 3 : 2;
    const points = draft.filter(
      (point, index) =>
        index === 0 ||
        point[0] !== draft[index - 1]![0] ||
        point[1] !== draft[index - 1]![1],
    );
    if (points.length < minimum) return;
    const layer: GeographyLayer = {
      id: crypto.randomUUID(),
      kind,
      name:
        kind === "region"
          ? "New region"
          : kind === "route"
            ? "New route"
            : "",
      visible: true,
      locked: false,
      zIndex: document.layers.length,
      style: layerDefaults(kind, terrain),
      points,
    };
    onChange({ ...document, layers: [...document.layers, layer] });
    setSelectedId(layer.id);
    setTool("select");
    setDraft([]);
  }

  function addPoint(event: ReactMouseEvent<SVGSVGElement>) {
    if (
      tool === "pan" ||
      tool === "select" ||
      (event.target as Element).closest("[data-geo-layer]")
    ) {
      return;
    }
    let point = canvasPoint(event.clientX, event.clientY);
    if (event.shiftKey && draft.length) {
      point = constrainGeographyAngle(draft[draft.length - 1]!, point);
    }
    setDraft((current) => [...current, point]);
  }

  function startPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (tool !== "pan" || event.button !== 0) return;
    panRef.current = {
      x: offset.x,
      y: offset.y,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePointer(event: ReactPointerEvent<SVGSVGElement>) {
    const vertex = vertexRef.current;
    if (vertex) {
      const layer = document.layers.find((item) => item.id === vertex.layerId);
      if (!layer || layer.locked) return;
      const points = [...layer.points];
      points[vertex.index] = canvasPoint(event.clientX, event.clientY);
      updateLayer(layer.id, { points });
      return;
    }
    const pan = panRef.current;
    if (!pan) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setOffset({
      x:
        pan.x +
        ((event.clientX - pan.clientX) / Math.max(1, rect.width)) *
          document.canvas.width,
      y:
        pan.y +
        ((event.clientY - pan.clientY) / Math.max(1, rect.height)) *
          document.canvas.height,
    });
  }

  function endPointer() {
    panRef.current = null;
    vertexRef.current = null;
  }

  function placeLocation(page: GeographyPage) {
    const index = document.layers.length;
    const x = 160 + (index % 5) * 180;
    const y = 140 + Math.floor(index / 5) * 150;
    const layer: GeographyLayer = {
      id: crypto.randomUUID(),
      kind: "region",
      name: page.title || "Untitled",
      pageId: page.id,
      visible: true,
      locked: false,
      zIndex: index,
      style: layerDefaults("region", terrain),
      points: [
        [x - 65, y - 40],
        [x + 65, y - 40],
        [x + 65, y + 40],
        [x - 65, y + 40],
      ],
    };
    onChange({ ...document, layers: [...document.layers, layer] });
    setSelectedId(layer.id);
    setTool("select");
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUploadBackground(file);
    event.target.value = "";
  }

  return (
    <div className="geography-view">
      <div className="geography-toolbar">
        <div className="geography-tools">
          {TOOL_LABELS.map((item) => (
            <button
              key={item.tool}
              type="button"
              aria-pressed={tool === item.tool}
              onClick={() => chooseTool(item.tool)}
            >
              {item.tool === "pan" ? (
                <Hand size={14} />
              ) : item.tool === "select" ? (
                <MousePointer2 size={14} />
              ) : (
                <span className={`geo-tool-symbol geo-${item.tool}`} />
              )}
              {item.label}
            </button>
          ))}
        </div>
        <label className="geography-zoom">
          Zoom
          <input
            type="range"
            min=".4"
            max="2.5"
            step=".1"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <button type="button" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={14} />
          {backgroundUrl ? "Replace background" : "Background"}
        </button>
        {backgroundUrl && (
          <>
            <label className="geography-zoom">
              Background
              <input
                type="range"
                min=".1"
                max="1"
                step=".05"
                value={document.background?.opacity ?? 0.65}
                onChange={(event) =>
                  onChange({
                    ...document,
                    background: {
                      fit: document.background?.fit ?? "contain",
                      opacity: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
            <select
              value={document.background?.fit ?? "contain"}
              aria-label="Background fit"
              onChange={(event) =>
                onChange({
                  ...document,
                  background: {
                    opacity: document.background?.opacity ?? 0.65,
                    fit: event.target.value === "cover" ? "cover" : "contain",
                  },
                })
              }
            >
              <option value="contain">Fit</option>
              <option value="cover">Fill</option>
            </select>
            <button type="button" onClick={onRemoveBackground}>
              <X size={14} />
              Remove
            </button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          onChange={upload}
        />
      </div>

      <div className="geography-body">
        <aside className="geography-sidebar">
          <section>
            <span className="eyebrow">LOCATIONS</span>
            {locations.map((page) => (
              <button
                key={page.id}
                type="button"
                className="geography-location"
                onClick={() => placeLocation(page)}
              >
                <MapPin size={13} />
                <span>{page.title || "Untitled"}</span>
              </button>
            ))}
            {locations.length === 0 && (
              <p>Create Location pages to place them on the map.</p>
            )}
          </section>

          {tool === "terrain" && (
            <section>
              <span className="eyebrow">TERRAIN</span>
              <div className="terrain-presets">
                {(
                  Object.entries(TERRAIN_PRESETS) as Array<
                    [
                      TerrainPreset,
                      (typeof TERRAIN_PRESETS)[TerrainPreset],
                    ]
                  >
                ).map(([name, style]) => (
                  <button
                    key={name}
                    type="button"
                    className={terrain === name ? "active" : ""}
                    style={{ "--terrain-color": style.fill } as CSSProperties}
                    onClick={() => setTerrain(name)}
                  >
                    <i />
                    {name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {draft.length > 0 && (
            <section className="geography-draft-actions">
              <p>
                {draft.length} point{draft.length === 1 ? "" : "s"} · Shift
                constrains angles
              </p>
              <button type="button" onClick={finishDraft}>
                <Check size={13} />
                Finish shape
              </button>
              <button type="button" onClick={() => setDraft([])}>
                Cancel
              </button>
            </section>
          )}

          <section className="geography-layers">
            <span className="eyebrow">LAYERS</span>
            {[...document.layers]
              .sort((left, right) => right.zIndex - left.zIndex)
              .map((layer) => (
                <div
                  key={layer.id}
                  className={selectedId === layer.id ? "active" : ""}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(layer.id);
                      setTool("select");
                    }}
                  >
                    {layer.name || layer.kind}
                  </button>
                  <button
                    type="button"
                    aria-label={layer.visible ? "Hide layer" : "Show layer"}
                    onClick={() =>
                      updateLayer(layer.id, { visible: !layer.visible })
                    }
                  >
                    {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    type="button"
                    aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
                    onClick={() =>
                      updateLayer(layer.id, { locked: !layer.locked })
                    }
                  >
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                </div>
              ))}
          </section>
        </aside>

        <main className="geography-stage">
          {selected && (
            <div className="geography-properties">
              <input
                value={selected.name}
                aria-label="Layer name"
                placeholder="Layer name"
                onChange={(event) =>
                  updateLayer(selected.id, { name: event.target.value })
                }
              />
              {selected.kind === "region" && (
                <select
                  value={selected.pageId ?? ""}
                  aria-label="Linked location"
                  onChange={(event) =>
                    updateLayer(selected.id, {
                      pageId: event.target.value || undefined,
                    })
                  }
                >
                  <option value="">No linked Location page</option>
                  {locations.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title || "Untitled"}
                    </option>
                  ))}
                </select>
              )}
              <label>
                Fill
                <input
                  type="color"
                  value={selected.style.fill}
                  onChange={(event) =>
                    updateLayer(selected.id, {
                      style: { ...selected.style, fill: event.target.value },
                    })
                  }
                />
              </label>
              <label>
                Line
                <input
                  type="color"
                  value={selected.style.stroke}
                  onChange={(event) =>
                    updateLayer(selected.id, {
                      style: { ...selected.style, stroke: event.target.value },
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="geography-delete"
                onClick={() => {
                  onChange({
                    ...document,
                    layers: document.layers.filter(
                      (layer) => layer.id !== selected.id,
                    ),
                  });
                  setSelectedId(null);
                }}
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          )}
          <svg
            ref={svgRef}
            className={`geography-canvas geography-tool-${tool}`}
            viewBox={`0 0 ${document.canvas.width} ${document.canvas.height}`}
            role="img"
            aria-label="Geography map builder"
            onClick={addPoint}
            onDoubleClick={(event) => {
              event.preventDefault();
              finishDraft();
            }}
            onPointerDown={startPointer}
            onPointerMove={movePointer}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
          >
            <defs>
              <marker
                id="geo-route-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L7,3 z" fill="#9a5f3f" />
              </marker>
            </defs>
            <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
              {backgroundUrl && (
                <image
                  href={backgroundUrl}
                  x="0"
                  y="0"
                  width={document.canvas.width}
                  height={document.canvas.height}
                  opacity={document.background?.opacity ?? 0.65}
                  preserveAspectRatio={
                    document.background?.fit === "cover"
                      ? "xMidYMid slice"
                      : "xMidYMid meet"
                  }
                />
              )}
              {document.layers
                .filter((layer) => layer.visible)
                .sort((left, right) => left.zIndex - right.zIndex)
                .map((layer) => {
                  const polygon =
                    layer.kind === "terrain" || layer.kind === "region";
                  const [labelX, labelY] = polygonCentroid(layer.points);
                  const common = {
                    points: pointsAttribute(layer.points),
                    fill: polygon ? layer.style.fill : "none",
                    stroke: layer.style.stroke,
                    strokeWidth: layer.style.strokeWidth,
                    opacity: layer.style.opacity,
                    strokeDasharray: layer.style.dash,
                  };
                  return (
                    <g
                      key={layer.id}
                      data-geo-layer={layer.id}
                      className={`geography-layer geography-layer-${layer.kind}${
                        selectedId === layer.id ? " selected" : ""
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (tool === "select") setSelectedId(layer.id);
                        if (layer.pageId && event.detail === 2) {
                          onOpenPage(layer.pageId);
                        }
                      }}
                    >
                      {polygon ? (
                        <polygon {...common} />
                      ) : (
                        <polyline
                          {...common}
                          markerEnd={
                            layer.kind === "route"
                              ? "url(#geo-route-arrow)"
                              : undefined
                          }
                        />
                      )}
                      {layer.name && (
                        <text
                          x={labelX}
                          y={labelY}
                          className="geography-label"
                        >
                          {layer.name}
                        </text>
                      )}
                      {selectedId === layer.id &&
                        !layer.locked &&
                        layer.points.map(([x, y], index) => (
                          <circle
                            key={`${layer.id}-${index}`}
                            cx={x}
                            cy={y}
                            r="7"
                            className="geography-handle"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              vertexRef.current = {
                                layerId: layer.id,
                                index,
                              };
                              event.currentTarget.setPointerCapture(
                                event.pointerId,
                              );
                            }}
                          />
                        ))}
                    </g>
                  );
                })}
              {draft.length > 0 && (
                <polyline
                  points={pointsAttribute(draft)}
                  className="geography-draft"
                />
              )}
            </g>
          </svg>
        </main>
      </div>
    </div>
  );
}
