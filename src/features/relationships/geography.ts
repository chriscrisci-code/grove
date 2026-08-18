export const GEO_CANVAS_WIDTH = 1200;
export const GEO_CANVAS_HEIGHT = 800;
export const MAX_GEO_LAYERS = 200;
export const MAX_GEO_POINTS = 500;

export const TERRAIN_PRESETS = {
  water: { fill: "#6a9fb5", opacity: 0.58 },
  forest: { fill: "#5a8a62", opacity: 0.5 },
  hill: { fill: "#8a8460", opacity: 0.46 },
  desert: { fill: "#c9b07a", opacity: 0.5 },
  snow: { fill: "#dce7e9", opacity: 0.58 },
  swamp: { fill: "#4a6a58", opacity: 0.5 },
} as const;

export type TerrainPreset = keyof typeof TERRAIN_PRESETS;
export type GeographyTool =
  | "pan"
  | "select"
  | "terrain"
  | "border"
  | "region"
  | "route";
export type GeographyPoint = [number, number];
export type GeographyLayerKind = "terrain" | "border" | "region" | "route";

export type GeographyLayer = {
  id: string;
  kind: GeographyLayerKind;
  name: string;
  pageId?: string;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  style: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    opacity: number;
    dash?: string;
    terrain?: TerrainPreset;
  };
  points: GeographyPoint[];
};

export type GeographyDocument = {
  version: 1;
  canvas: { width: number; height: number };
  background?: {
    opacity: number;
    fit: "contain" | "cover";
  };
  layers: GeographyLayer[];
};

export function emptyGeographyDocument(): GeographyDocument {
  return {
    version: 1,
    canvas: { width: GEO_CANVAS_WIDTH, height: GEO_CANVAS_HEIGHT },
    layers: [],
  };
}

function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function validHex(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

export function normalizeGeographyDocument(
  value: unknown,
): GeographyDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyGeographyDocument();
  }
  const raw = value as Record<string, unknown>;
  const rawCanvas =
    raw.canvas && typeof raw.canvas === "object" && !Array.isArray(raw.canvas)
      ? (raw.canvas as Record<string, unknown>)
      : {};
  const layers = Array.isArray(raw.layers)
    ? raw.layers.slice(0, MAX_GEO_LAYERS)
    : [];
  return {
    version: 1,
    canvas: {
      width: Math.max(
        600,
        Math.min(4000, finiteNumber(rawCanvas.width, GEO_CANVAS_WIDTH)),
      ),
      height: Math.max(
        400,
        Math.min(4000, finiteNumber(rawCanvas.height, GEO_CANVAS_HEIGHT)),
      ),
    },
    background:
      raw.background &&
      typeof raw.background === "object" &&
      !Array.isArray(raw.background)
        ? {
            opacity: Math.max(
              0.05,
              Math.min(
                1,
                finiteNumber(
                  (raw.background as Record<string, unknown>).opacity,
                  0.65,
                ),
              ),
            ),
            fit:
              (raw.background as Record<string, unknown>).fit === "cover"
                ? "cover"
                : "contain",
          }
        : undefined,
    layers: layers.flatMap((item, index): GeographyLayer[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const layer = item as Record<string, unknown>;
      if (
        layer.kind !== "terrain" &&
        layer.kind !== "border" &&
        layer.kind !== "region" &&
        layer.kind !== "route"
      ) {
        return [];
      }
      const rawStyle =
        layer.style &&
        typeof layer.style === "object" &&
        !Array.isArray(layer.style)
          ? (layer.style as Record<string, unknown>)
          : {};
      const points = Array.isArray(layer.points)
        ? layer.points
            .slice(0, MAX_GEO_POINTS)
            .flatMap((point): GeographyPoint[] => {
              if (!Array.isArray(point) || point.length < 2) return [];
              const x = Number(point[0]);
              const y = Number(point[1]);
              return Number.isFinite(x) && Number.isFinite(y) ? [[x, y]] : [];
            })
        : [];
      if (points.length < 2) return [];
      return [
        {
          id: typeof layer.id === "string" ? layer.id : `layer-${index}`,
          kind: layer.kind,
          name:
            typeof layer.name === "string" ? layer.name.slice(0, 80) : "",
          pageId:
            typeof layer.pageId === "string" ? layer.pageId : undefined,
          visible: layer.visible !== false,
          locked: layer.locked === true,
          zIndex: finiteNumber(layer.zIndex, index),
          style: {
            fill: validHex(rawStyle.fill, "#d9d2b8"),
            stroke: validHex(rawStyle.stroke, "#526357"),
            strokeWidth: Math.max(
              0.5,
              Math.min(12, finiteNumber(rawStyle.strokeWidth, 2)),
            ),
            opacity: Math.max(
              0.05,
              Math.min(1, finiteNumber(rawStyle.opacity, 0.7)),
            ),
            dash: typeof rawStyle.dash === "string" ? rawStyle.dash : undefined,
            terrain:
              typeof rawStyle.terrain === "string" &&
              rawStyle.terrain in TERRAIN_PRESETS
                ? (rawStyle.terrain as TerrainPreset)
                : undefined,
          },
          points,
        },
      ];
    }),
  };
}

export function pointsAttribute(points: GeographyPoint[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function polygonCentroid(points: GeographyPoint[]): GeographyPoint {
  if (!points.length) return [0, 0];
  const [x, y] = points.reduce(
    ([totalX, totalY], [pointX, pointY]) => [
      totalX + pointX,
      totalY + pointY,
    ],
    [0, 0],
  );
  return [x / points.length, y / points.length];
}

export function constrainGeographyAngle(
  origin: GeographyPoint,
  point: GeographyPoint,
): GeographyPoint {
  const dx = point[0] - origin[0];
  const dy = point[1] - origin[1];
  const distance = Math.hypot(dx, dy);
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [
    origin[0] + Math.cos(angle) * distance,
    origin[1] + Math.sin(angle) * distance,
  ];
}
