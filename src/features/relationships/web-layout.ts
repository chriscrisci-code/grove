export const WEB_X_FIELD = "webX";
export const WEB_Y_FIELD = "webY";
export const WEB_DRAG_THRESHOLD = 5;
export const WEB_CANVAS_WIDTH = 920;
export const WEB_CANVAS_HEIGHT = 640;

export function parseWebCoord(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const coord = Number(value);
  return Number.isFinite(coord) ? coord : null;
}

export function serializeWebCoord(value: number): string {
  return String(Math.round(value));
}

export function defaultWebPosition(index: number) {
  const column = index % 5;
  const row = Math.floor(index / 5);
  return {
    x: 110 + column * 160 + (row % 2 ? 50 : 0),
    y: 90 + row * 130,
  };
}

export function webPositionFromFields(fields: Record<string, string>) {
  const x = parseWebCoord(fields[WEB_X_FIELD]);
  const y = parseWebCoord(fields[WEB_Y_FIELD]);
  if (x == null || y == null) return null;
  return { x, y };
}

export function withWebPosition(
  fields: Record<string, string>,
  x: number,
  y: number,
): Record<string, string> {
  return {
    ...fields,
    [WEB_X_FIELD]: serializeWebCoord(x),
    [WEB_Y_FIELD]: serializeWebCoord(y),
  };
}
