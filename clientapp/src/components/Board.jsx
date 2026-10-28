import { useMemo } from 'react';
import HexTile from './HexTile';
import NodeMarker from './NodeMarker';
import EdgeMarker from './EdgeMarker';
import PortMarker from './PortMarker';
import TerrainDefs from './TerrainDefs';
import { ROW_LENGTHS } from '../boardData';
import { HEX_SIZE, HEX_WIDTH, VERTICAL_STEP, cornerPosition } from '../hexGeometry';

// Widest row (5 hexes) sets the board width; 5 rows set the height.
const BOARD_WIDTH = Math.max(...ROW_LENGTHS) * HEX_WIDTH;
const BOARD_HEIGHT = (ROW_LENGTHS.length - 1) * VERTICAL_STEP + 2 * HEX_SIZE;

// Must clear the port shields (OFFSET 0.62 * HEX_SIZE + shield radius 0.3 * HEX_SIZE) plus hover scaling.
const PADDING = HEX_SIZE * 0.98;

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
  upgradablePlayerId = null,
  robberMode = false,
  interactive = true,
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

  // A port is an edge whose two intersections carry the same harbour. Its badge is
  // pushed outward from the board centre so it sits in the sea.
  const ports = useMemo(() => {
    const harborById = new Map(nodes.map((n) => [n.id, n.harbor]));
    const centre = { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 };
    const result = [];
    for (const edge of edges) {
      const harbor = harborById.get(edge.nodeAId);
      if (!harbor || harbor === 'None' || harbor !== harborById.get(edge.nodeBId)) continue;
      const from = nodePositions.get(edge.nodeAId);
      const to = nodePositions.get(edge.nodeBId);
      if (!from || !to) continue;
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      result.push({
        id: edge.id,
        harbor,
        from,
        to,
        seaward: { x: mid.x - centre.x, y: mid.y - centre.y },
      });
    }
    return result;
  }, [edges, nodes, nodePositions]);

  return (
    <svg
      viewBox={`${-PADDING} ${-PADDING} ${BOARD_WIDTH + PADDING * 2} ${BOARD_HEIGHT + PADDING * 2}`}
      className="h-full max-h-full w-full max-w-full object-contain drop-shadow-xl"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Catan board"
    >
      <TerrainDefs />

      <g aria-label="Tiles">
        {tiles.map((tile) => (
          <HexTile
            key={tile.id}
            tile={tile}
            isSelected={tile.id === selectedId}
            onSelect={onTileSelect}
            robberMode={robberMode}
          />
        ))}
      </g>

      <g aria-label="Ports">
        {ports.map((port) => (
          <PortMarker key={port.id} harbor={port.harbor} from={port.from} to={port.to} seaward={port.seaward} />
        ))}
      </g>

      <g aria-label="Paths" className={robberMode || !interactive ? 'pointer-events-none' : undefined}>
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

      <g aria-label="Intersections" className={robberMode || !interactive ? 'pointer-events-none' : undefined}>
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
              upgradable={
                upgradablePlayerId != null &&
                node.building === 'Settlement' &&
                node.ownerId === upgradablePlayerId
              }
              onClick={onNodeClick}
            />
          );
        })}
      </g>
    </svg>
  );
}
