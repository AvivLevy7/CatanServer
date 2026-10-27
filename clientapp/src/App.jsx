import { useState } from 'react';
import Board from './components/Board';
import DicePanel from './components/DicePanel';
import DevCardPanel from './components/DevCardPanel';
import { MonopolyModal, YearOfPlentyModal } from './components/DevCardModals';
import DiscardModal from './components/DiscardModal';
import GameOverOverlay from './components/GameOverOverlay';
import PhaseBanner from './components/PhaseBanner';
import PlayerPanel from './components/PlayerPanel';
import StealPicker from './components/StealPicker';
import TradePanel from './components/TradePanel';
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
    buildCity,
    tradeWithBank,
    discardCards,
    moveRobber,
    getStealCandidates,
    buyDevelopmentCard,
    playKnightCard,
    playMonopoly,
    playYearOfPlenty,
    playRoadBuilding,
    winner,
    placeInitialSettlement,
    placeInitialRoad,
    startGame,
  } = useGameHub();
  const [selected, setSelected] = useState(null);
  const [playerCount, setPlayerCount] = useState(4);
  // Robber destination awaiting a steal-target choice.
  const [pendingRobber, setPendingRobber] = useState(null);
  // Action card awaiting its choice modal: { type, cardId }.
  const [pendingCard, setPendingCard] = useState(null);

  // Hold the loading screen until the first BoardState arrives from the hub.
  if (!board) {
    return <StatusScreen status={status} error={error} />;
  }

  // GameState carries the freshest board (with node/edge ownership and robber); BoardState is the fallback.
  const liveBoard = game?.board ?? board;

  // The server DTO already carries row/col/rowLength, so no client-side maths.
  const tiles = liveBoard.hexes.map((hex) => ({
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

  const playerColors = Object.fromEntries(players.map((p) => [p.id, p.color]));

  const phase = game?.phase ?? 'SetupRound1';
  const isSetup = phase === 'SetupRound1' || phase === 'SetupRound2';
  const isDiscarding = phase === 'WaitingForDiscards';
  const isMovingRobber = phase === 'MovingRobber';
  const isPlacingFreeRoads = phase === 'PlacingFreeRoads';
  const isGameOver = phase === 'GameOver';
  const isMainGame = phase === 'MainGame';
  const winningPlayer = winner ?? players.find((p) => p.id === game?.winnerId) ?? null;

  // Hot-seat: walk owing players one at a time, in seat order.
  const pendingDiscards = game?.pendingDiscards ?? {};
  const discardingPlayer = players.find((p) => pendingDiscards[p.id] != null) ?? null;
  const robberMover = players.find((p) => p.id === game?.robberMoverId) ?? null;

  const handleNodeClick = (node) => {
    if (isSetup) {
      if (node.building === 'None') placeInitialSettlement(node.id);
      return;
    }
    if (!isMainGame) return;

    if (node.building === 'None') {
      buildSettlement(node.id);
    } else if (node.building === 'Settlement' && node.ownerId === currentTurnPlayerId) {
      buildCity(node.id);
    }
  };

  const handleEdgeClick = (edge) => {
    if (edge.ownerId != null) return;
    if (isSetup) {
      placeInitialRoad(edge.id);
    } else if (isMainGame || isPlacingFreeRoads) {
      buildRoad(edge.id);
    }
  };

  const handlePlayCard = (card) => {
    switch (card.type) {
      case 'Knight':
        playKnightCard(card.id);
        break;
      case 'RoadBuilding':
        playRoadBuilding(card.id);
        break;
      case 'Monopoly':
      case 'YearOfPlenty':
        setPendingCard({ type: card.type, cardId: card.id });
        break;
      default:
        break;
    }
  };

  const handleTileSelect = async (tile) => {
    if (!isMovingRobber) {
      setSelected(tile);
      return;
    }

    if (tile.hasRobber) return;

    const candidateIds = await getStealCandidates(tile.id);
    if (candidateIds.length === 0) {
      moveRobber(tile.id, null);
    } else if (candidateIds.length === 1) {
      moveRobber(tile.id, candidateIds[0]);
    } else {
      setPendingRobber({ hexId: tile.id, candidateIds });
    }
  };

  const handleStealPick = async (victimId) => {
    const { hexId } = pendingRobber;
    setPendingRobber(null);
    await moveRobber(hexId, victimId);
  };

  const handleNewGame = () => {
    startGame(playerCount);
    setSelected(null);
    setPendingRobber(null);
    setPendingCard(null);
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
            onTileSelect={handleTileSelect}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            highlightNodeId={isSetup ? game?.pendingSetupSettlementNodeId ?? null : null}
            upgradablePlayerId={isMainGame ? currentTurnPlayerId : null}
            robberMode={isMovingRobber}
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
          <PhaseBanner game={game} currentPlayer={currentPlayer} robberMover={robberMover} />
          <DicePanel
            roll={roll}
            currentPlayer={currentPlayer}
            rolledBy={rolledBy}
            onRoll={rollDice}
            disabled={!isLive || !isMainGame}
          />
          {isMainGame && (
            <TradePanel
              player={currentPlayer}
              onTrade={tradeWithBank}
              disabled={!isLive}
            />
          )}
          {isMainGame && (
            <DevCardPanel
              player={currentPlayer}
              deckRemaining={game?.developmentCardsRemaining}
              onBuy={buyDevelopmentCard}
              onPlay={handlePlayCard}
              disabled={!isLive}
            />
          )}
          {game ? (
            <PlayerPanel
              players={players}
              currentTurnPlayerId={currentTurnPlayerId}
              largestArmyHolderId={game?.largestArmyHolderId}
              longestRoadHolderId={game?.longestRoadHolderId}
            />
          ) : (
            <p className="text-center text-sm text-sky-300">Waiting for game state...</p>
          )}
        </aside>
      </div>

      {isDiscarding && discardingPlayer && (
        <DiscardModal
          player={discardingPlayer}
          owed={pendingDiscards[discardingPlayer.id]}
          onDiscard={discardCards}
          disabled={!isLive}
        />
      )}

      {pendingRobber && (
        <StealPicker
          candidates={players.filter((p) => pendingRobber.candidateIds.includes(p.id))}
          onPick={handleStealPick}
          onCancel={() => setPendingRobber(null)}
          disabled={!isLive}
        />
      )}

      {pendingCard?.type === 'Monopoly' && (
        <MonopolyModal
          disabled={!isLive}
          onCancel={() => setPendingCard(null)}
          onConfirm={async (resource) => {
            const { cardId } = pendingCard;
            setPendingCard(null);
            await playMonopoly(cardId, resource);
          }}
        />
      )}

      {pendingCard?.type === 'YearOfPlenty' && (
        <YearOfPlentyModal
          disabled={!isLive}
          onCancel={() => setPendingCard(null)}
          onConfirm={async (a, b) => {
            const { cardId } = pendingCard;
            setPendingCard(null);
            await playYearOfPlenty(cardId, a, b);
          }}
        />
      )}

      {isGameOver && (
        <GameOverOverlay
          winner={winningPlayer}
          players={players}
          onNewGame={handleNewGame}
          disabled={!isLive}
        />
      )}
    </main>
  );
}
