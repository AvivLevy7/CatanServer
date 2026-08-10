import HexTile, { HEX_SIZE, HEX_WIDTH, VERTICAL_STEP } from './HexTile';
import { ROW_LENGTHS } from '../boardData';

// Widest row (5 hexes) sets the board width; 5 rows set the height.
const BOARD_WIDTH = Math.max(...ROW_LENGTHS) * HEX_WIDTH;
const BOARD_HEIGHT = (ROW_LENGTHS.length - 1) * VERTICAL_STEP + 2 * HEX_SIZE;

// Breathing room so hover scaling and stroke widths never clip at the edges.
const PADDING = 14;

export default function Board({ tiles, selectedId, onTileSelect }) {
  return (
    <svg
      viewBox={`${-PADDING} ${-PADDING} ${BOARD_WIDTH + PADDING * 2} ${BOARD_HEIGHT + PADDING * 2}`}
      className="h-auto w-full max-w-2xl drop-shadow-xl"
      role="img"
      aria-label="Catan board"
    >
      {tiles.map((tile) => (
        <HexTile
          key={tile.id}
          tile={tile}
          isSelected={tile.id === selectedId}
          onSelect={onTileSelect}
        />
      ))}
    </svg>
  );
}
