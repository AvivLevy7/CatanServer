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

// Shared empty default so an omitted prop never allocates a new Set per render.
const EMPTY_SET = new Set();
const EMPTY_ARRAY = [];

// Dice pips per number token, mirroring the dots printed on the physical tokens.
const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

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
  // Hex ids that just produced on the latest roll; the rest of the island dims behind them.
  producingHexIds = EMPTY_SET,
  // Node/edge ids built within the last beat, for the drop-and-dust impact.
  placedNodeIds = EMPTY_SET,
  placedEdgeIds = EMPTY_SET,
  // Edge ids of a Longest Road trail being celebrated, in order along the route.
  roadClaimPath = EMPTY_ARRAY,
  // Setup only: show each empty corner's total dice pips.
  showPips = false,
}) {
  // Position within the trail drives the stagger, so look-up has to be by id.
  const claimOrder = useMemo(
    () => new Map(roadClaimPath.map((edgeId, i) => [edgeId, i])),
    [roadClaimPath],
  );

  // Total pips of the hexes touching each intersection: how much production a starting
  // settlement there would actually see. 6 and 8 are worth 5 each, 2 and 12 just 1.
  const pipsByNode = useMemo(() => {
    if (!showPips) return null;
    const pipsByHex = new Map(tiles.map((tile) => [tile.id, PIPS[tile.numberToken] ?? 0]));
    const totals = new Map();
    for (const node of nodes) {
      let total = 0;
      for (const hexId of node.hexIds ?? []) total += pipsByHex.get(hexId) ?? 0;
      totals.set(node.id, total);
    }
    return totals;
  }, [showPips, tiles, nodes]);
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
            producing={producingHexIds.has(tile.id)}
            dimmed={producingHexIds.size > 0 && !producingHexIds.has(tile.id)}
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
              justPlaced={placedEdgeIds.has(edge.id)}
              claimIndex={claimOrder.get(edge.id) ?? -1}
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
              justPlaced={placedNodeIds.has(node.id)}
              pips={pipsByNode?.get(node.id) ?? null}
              onClick={onNodeClick}
            />
          );
        })}
      </g>
    </svg>
  );
}
