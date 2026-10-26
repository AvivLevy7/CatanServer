import { useState } from 'react';
import Board from './components/Board';
import DicePanel from './components/DicePanel';
import PhaseBanner from './components/PhaseBanner';
import PlayerPanel from './components/PlayerPanel';
import { useGameHub } from './useGameHub';

const RESOURCE_LABELS = {
  Forest: 'Lumber',
  Pasture: 'Wool',
  Fields: 'Grain',
  Hills: 'Brick',
  Mountains: 'Ore',
  Desert: 'None',
};

const STATUS_LABELS = {
  connecting: 'Connecting to server...',
  connected: 'Live',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
  error: 'Connection failed',
};

function StatusScreen({ status, error }) {
  const isError = status === 'error' || status === 'disconnected';

  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center gap-4 bg-sky-900 p-6 text-center">
      {!isError && (
        <span
          className="size-10 animate-spin rounded-full border-4 border-sky-700 border-t-amber-200"
          role="status"
          aria-label="Connecting"
        />
      )}
      <p className="text-lg font-medium text-amber-50">
        {STATUS_LABELS[status] ?? status}
      </p>
      {isError && (
        <p className="max-w-sm text-sm text-sky-300">
          {error ?? 'The game server is unreachable.'} Start the C# server, then reload.
        </p>
      )}
    </main>
  );
}

export default function App() {
  const {
    board,
    game,
    lastRoll,
    status,
    error,
    actionError,
    clearActionError,
    rollDice,
    buildSettlement,
    buildRoad,
    placeInitialSettlement,
    placeInitialRoad,
    startGame,
  } = useGameHub();
  const [selected, setSelected] = useState(null);
  const [playerCount, setPlayerCount] = useState(4);

  // Hold the loading screen until the first BoardState arrives from the hub.
  if (!board) {
    return <StatusScreen status={status} error={error} />;
  }

  // The server DTO already carries row/col/rowLength, so no client-side maths.
  const tiles = board.hexes.map((hex) => ({
    id: hex.id,
    row: hex.row,
    col: hex.col,
    rowLength: hex.rowLength,
    type: hex.type,
    numberToken: hex.numberToken,
    hasRobber: hex.hasRobber,
  }));

  const players = game?.players ?? [];
  const currentTurnPlayerId = game?.currentTurnPlayerId ?? null;
  const currentPlayer = players.find((p) => p.id === currentTurnPlayerId) ?? null;
  // Prefer the DiceRolled event (carries production); fall back to the snapshot's lastRoll.
  const roll = lastRoll?.roll ?? game?.lastRoll ?? null;
  const rolledBy = players.find((p) => p.id === lastRoll?.rolledBy) ?? null;
  const isLive = status === 'connected';

  // GameState carries the freshest board (with node/edge ownership); BoardState is the fallback.
  const liveBoard = game?.board ?? board;
  const playerColors = Object.fromEntries(players.map((p) => [p.id, p.color]));

  const isSetup = game != null && game.phase !== 'MainGame';

  const handleNodeClick = (node) => {
    if (node.building !== 'None') return;
    if (isSetup) {
      placeInitialSettlement(node.id);
    } else {
      buildSettlement(node.id);
    }
  };

  const handleEdgeClick = (edge) => {
    if (edge.ownerId != null) return;
    if (isSetup) {
      placeInitialRoad(edge.id);
    } else {
      buildRoad(edge.id);
    }
  };

  const handleNewGame = () => {
    startGame(playerCount);
    setSelected(null);
  };

  return (
    <main className="flex min-h-svh w-full flex-col gap-6 bg-sky-900 p-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-amber-50">Catan</h1>
        <p className="mt-1 text-sm text-sky-200">
          {selected
            ? `${selected.type} / ${RESOURCE_LABELS[selected.type]}${
                selected.numberToken ? ` / rolls on ${selected.numberToken}` : ''
              }`
            : 'Select a tile to inspect it'}
        </p>
        <p className="mt-1 flex items-center justify-center gap-2 text-xs text-sky-300">
          <span
            className={`inline-block size-2 rounded-full ${
              isLive ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          {STATUS_LABELS[status] ?? status}
        </p>
        {actionError && (
          <button
            type="button"
            onClick={clearActionError}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white shadow"
            role="alert"
          >
            {actionError}
            <span aria-hidden="true" className="text-red-100">&times;</span>
          </button>
        )}
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          aria-label="Board"
          className="flex min-w-0 flex-col items-center justify-center gap-4"
        >
          <Board
            tiles={tiles}
            nodes={liveBoard.nodes ?? []}
            edges={liveBoard.edges ?? []}
            playerColors={playerColors}
            selectedId={selected?.id}
            onTileSelect={setSelected}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            highlightNodeId={isSetup ? game?.pendingSetupSettlementNodeId ?? null : null}
          />

          <div className="flex flex-wrap items-center justify-center gap-3">
            <fieldset className="flex items-center gap-1 rounded-lg bg-sky-800/70 p-1" aria-label="Number of players">
              {[3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setPlayerCount(count)}
                  aria-pressed={playerCount === count}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                    playerCount === count
                      ? 'bg-amber-100 text-stone-900 shadow'
                      : 'text-amber-50 hover:bg-sky-700'
                  }`}
                >
                  {count} players
                </button>
              ))}
            </fieldset>

            <button
              type="button"
              onClick={handleNewGame}
              disabled={!isLive}
              className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              New game (all players)
            </button>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <PhaseBanner game={game} currentPlayer={currentPlayer} />
          <DicePanel
            roll={roll}
            currentPlayer={currentPlayer}
            rolledBy={rolledBy}
            onRoll={rollDice}
            disabled={!isLive || !game || isSetup}
          />
          {game ? (
            <PlayerPanel players={players} currentTurnPlayerId={currentTurnPlayerId} />
          ) : (
            <p className="text-center text-sm text-sky-300">Waiting for game state...</p>
          )}
        </aside>
      </div>
    </main>
  );
}
