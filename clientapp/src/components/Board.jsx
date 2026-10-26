import { useMemo } from 'react';
import HexTile from './HexTile';
import NodeMarker from './NodeMarker';
import EdgeMarker from './EdgeMarker';
import { ROW_LENGTHS } from '../boardData';
import { HEX_SIZE, HEX_WIDTH, VERTICAL_STEP, cornerPosition } from '../hexGeometry';

// Widest row (5 hexes) sets the board width; 5 rows set the height.
const BOARD_WIDTH = Math.max(...ROW_LENGTHS) * HEX_WIDTH;
const BOARD_HEIGHT = (ROW_LENGTHS.length - 1) * VERTICAL_STEP + 2 * HEX_SIZE;

// Breathing room so hover scaling and stroke widths never clip at the edges.
const PADDING = 14;

export default function Board({
  tiles,
  nodes = [],
  edges = [],
  playerColors = {},
  selectedId,
  onTileSelect,
  onNodeClick,
  onEdgeClick,
  highlightNodeId = null,
}) {
  // Every node is anchored to a real hex corner, so its position is exactly the
  // same formula HexTile uses to draw that corner - no drift between layers.
  const nodePositions = useMemo(() => {
    const tileById = new Map(tiles.map((tile) => [tile.id, tile]));
    const positions = new Map();
    for (const node of nodes) {
      const tile = tileById.get(node.anchorHexId);
      if (tile) {
        positions.set(node.id, cornerPosition(tile, node.anchorCorner));
      }
    }
    return positions;
  }, [tiles, nodes]);

  return (
    <svg
      viewBox={`${-PADDING} ${-PADDING} ${BOARD_WIDTH + PADDING * 2} ${BOARD_HEIGHT + PADDING * 2}`}
      className="h-auto w-full max-w-2xl drop-shadow-xl"
      role="img"
      aria-label="Catan board"
    >
      <g aria-label="Tiles">
        {tiles.map((tile) => (
          <HexTile
            key={tile.id}
            tile={tile}
            isSelected={tile.id === selectedId}
            onSelect={onTileSelect}
          />
        ))}
      </g>

      <g aria-label="Paths">
        {edges.map((edge) => {
          const from = nodePositions.get(edge.nodeAId);
          const to = nodePositions.get(edge.nodeBId);
          if (!from || !to) return null;
          return (
            <EdgeMarker
              key={edge.id}
              edge={edge}
              from={from}
              to={to}
              ownerColor={playerColors[edge.ownerId]}
              highlighted={
                highlightNodeId != null &&
                edge.ownerId == null &&
                (edge.nodeAId === highlightNodeId || edge.nodeBId === highlightNodeId)
              }
              onClick={onEdgeClick}
            />
          );
        })}
      </g>

      <g aria-label="Intersections">
        {nodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;
          return (
            <NodeMarker
              key={node.id}
              node={node}
              x={pos.x}
              y={pos.y}
              ownerColor={playerColors[node.ownerId]}
              onClick={onNodeClick}
            />
          );
        })}
      </g>
    </svg>
  );
}
