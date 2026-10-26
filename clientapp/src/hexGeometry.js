// Shared pointy-top hex geometry. HexTile, nodes and edges all derive their
// positions from these helpers so they align pixel-perfectly.
export const HEX_SIZE = 60;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
export const VERTICAL_STEP = 1.5 * HEX_SIZE;
export const MAX_ROW_LENGTH = 5;

// Must match the server's HexCorner enum (clockwise from the north vertex).
const CORNER_INDEX = {
  North: 0,
  NorthEast: 1,
  SouthEast: 2,
  South: 3,
  SouthWest: 4,
  NorthWest: 5,
};

/** Centre of a hex given its row/col/rowLength from the server DTO. */
export function hexCenter({ row, col, rowLength }) {
  const rowOffset = ((MAX_ROW_LENGTH - rowLength) * HEX_WIDTH) / 2;
  return {
    x: rowOffset + col * HEX_WIDTH + HEX_WIDTH / 2,
    y: row * VERTICAL_STEP + HEX_SIZE,
  };
}

/** Offset of a corner relative to the hex centre. Index 0 is north, clockwise. */
export function cornerOffset(index) {
  const angle = (Math.PI / 180) * (60 * index - 90);
  return { dx: HEX_SIZE * Math.cos(angle), dy: HEX_SIZE * Math.sin(angle) };
}

/** Absolute position of a named corner of the given hex. */
export function cornerPosition(hex, cornerName) {
  const { x, y } = hexCenter(hex);
  const { dx, dy } = cornerOffset(CORNER_INDEX[cornerName]);
  return { x: x + dx, y: y + dy };
}

// SVG points attribute for a hex centred on the origin.
export const HEX_POINTS = Array.from({ length: 6 }, (_, i) => {
  const { dx, dy } = cornerOffset(i);
  return `${dx.toFixed(3)},${dy.toFixed(3)}`;
}).join(' ');
