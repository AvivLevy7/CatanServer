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
import PlayerTradePanel from './components/PlayerTradePanel';
import TradeOfferModal from './components/TradeOfferModal';
import { LandingPage, WaitingRoom } from './components/Lobby';
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
    room,
    session,
    myPlayerId,
    createRoom,
    joinRoom,
    leaveRoom,
    board,
    game,
    lastRoll,
    status,
    error,
    actionError,
    clearActionError,
    rollDice,
    endTurn,
    buildSettlement,
    buildRoad,
    buildCity,
    tradeWithBank,
    proposeTrade,
    acceptTrade,
    rejectTrade,
    cancelTrade,
    lastTradeResult,
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
  // Robber destination awaiting a steal-target choice.
  const [pendingRobber, setPendingRobber] = useState(null);
  // Action card awaiting its choice modal: { type, cardId }.
  const [pendingCard, setPendingCard] = useState(null);

  const isLive = status === 'connected';

  // Wait for the socket, then route: no room -> landing, lobby -> waiting room, in game -> board.
  if (status === 'connecting' || status === 'error' || status === 'disconnected') {
    return <StatusScreen status={status} error={error} />;
  }

  if (!room || !session) {
    return <LandingPage onCreate={createRoom} onJoin={joinRoom} disabled={!isLive} error={actionError} />;
  }

  if (room.status !== 'InGame') {
    return (
      <WaitingRoom
        room={room}
        myPlayerId={session.playerId}
        onStart={startGame}
        onLeave={leaveRoom}
        disabled={!isLive}
      />
    );
  }

  // Game started but the first BoardState push has not landed yet.
  if (!board) {
    return <StatusScreen status="connecting" error={null} />;
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

  const playerColors = Object.fromEntries(players.map((p) => [p.id, p.color]));

  const phase = game?.phase ?? 'SetupRound1';
  const isSetup = phase === 'SetupRound1' || phase === 'SetupRound2';
  const isDiscarding = phase === 'WaitingForDiscards';
  const isMovingRobber = phase === 'MovingRobber';
  const isPlacingFreeRoads = phase === 'PlacingFreeRoads';
  const isGameOver = phase === 'GameOver';
  const isMainGame = phase === 'MainGame';
  const winningPlayer = winner ?? players.find((p) => p.id === game?.winnerId) ?? null;

  // Identity: this tab may only act as its own seat.
  const me = players.find((p) => p.id === myPlayerId) ?? null;
  const isMyTurn = myPlayerId != null && myPlayerId === currentTurnPlayerId;
  const robberMover = players.find((p) => p.id === game?.robberMoverId) ?? null;
  const iMoveRobber = isMovingRobber && game?.robberMoverId === myPlayerId;
  const canAct = isLive && isMyTurn;
  // Server serialises GameStateDto.HasRolledDice as camelCase "hasRolledDice".
  const hasRolled = game?.hasRolledDice === true;
  // Build/trade need a roll first; dev cards do not (a pre-roll Knight is legal).
  const canBuild = canAct && isMainGame && hasRolled;

  // Discards: only this tab's own debt is shown here.
  const pendingDiscards = game?.pendingDiscards ?? {};
  const myDiscard = myPlayerId != null ? pendingDiscards[myPlayerId] ?? null : null;

  // Trades: the sender sees a waiting view; only addressed recipients get Accept/Reject.
  const activeOffer = game?.activeTradeOffer ?? null;
  const offerSender = players.find((p) => p.id === activeOffer?.senderPlayerId) ?? null;
  const iAmOfferRecipient =
    !!activeOffer &&
    activeOffer.senderPlayerId !== myPlayerId &&
    (activeOffer.targetPlayerId == null || activeOffer.targetPlayerId === myPlayerId) &&
    !(activeOffer.declinedBy ?? []).includes(myPlayerId);
  const opponents = players.filter((p) => p.id !== myPlayerId);

  const handleNodeClick = (node) => {
    if (!canAct) return;
    if (isSetup) {
      if (node.building === 'None') placeInitialSettlement(node.id);
      return;
    }
    if (!isMainGame) return;
    if (!hasRolled) return;

    if (node.building === 'None') {
      buildSettlement(node.id);
    } else if (node.building === 'Settlement' && node.ownerId === myPlayerId) {
      buildCity(node.id);
    }
  };

  const handleEdgeClick = (edge) => {
    if (!canAct) return;
    if (edge.ownerId != null) return;
    if (isSetup) {
      placeInitialRoad(edge.id);
    } else if (isPlacingFreeRoads || (isMainGame && hasRolled)) {
      buildRoad(edge.id);
    }
  };

  const handlePlayCard = (card) => {
    if (!canAct) return;
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

    if (!iMoveRobber || tile.hasRobber) return;

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
          <span aria-hidden="true">&middot;</span>
          Room <span className="font-mono font-bold text-amber-50">{room.roomId}</span>
          {me && (
            <>
              <span aria-hidden="true">&middot;</span>
              You are <span className="font-semibold text-amber-50">{me.name}</span>
            </>
          )}
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
            highlightNodeId={isSetup && isMyTurn ? game?.pendingSetupSettlementNodeId ?? null : null}
            upgradablePlayerId={isMainGame && isMyTurn ? myPlayerId : null}
            robberMode={iMoveRobber}
            interactive={iMoveRobber || (canAct && (isSetup || isPlacingFreeRoads || canBuild))}
          />

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={leaveRoom}
              className="rounded-lg border border-amber-100/40 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-sky-800"
            >
              Leave room
            </button>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <PhaseBanner
            game={game}
            currentPlayer={currentPlayer}
            robberMover={robberMover}
            isMyTurn={isMovingRobber || isDiscarding ? iMoveRobber : isMyTurn}
          />
          <DicePanel
            roll={roll}
            currentPlayer={currentPlayer}
            rolledBy={rolledBy}
            onRoll={rollDice}
            onEndTurn={endTurn}
            isMyTurn={isMyTurn}
            hasRolled={hasRolled}
            canRoll={canAct && isMainGame && !hasRolled}
            canEndTurn={canAct && isMainGame && hasRolled}
            waitingOnRobber={isMovingRobber || isDiscarding}
          />
          {isMainGame && isMyTurn && (
            <TradePanel
              player={me}
              onTrade={tradeWithBank}
              disabled={!canBuild}
            />
          )}
          {isMainGame && isMyTurn && (
            <PlayerTradePanel
              player={me}
              opponents={opponents}
              activeOffer={activeOffer}
              lastResult={lastTradeResult}
              onPropose={proposeTrade}
              onCancel={cancelTrade}
              disabled={!canBuild}
            />
          )}
          {isMainGame && me && (
            <DevCardPanel
              player={me}
              deckRemaining={game?.developmentCardsRemaining}
              onBuy={buyDevelopmentCard}
              onPlay={handlePlayCard}
              disabled={!canAct}
              canBuy={canBuild}
            />
          )}
          {game ? (
            <PlayerPanel
              players={players}
              currentTurnPlayerId={currentTurnPlayerId}
              myPlayerId={myPlayerId}
              largestArmyHolderId={game?.largestArmyHolderId}
              longestRoadHolderId={game?.longestRoadHolderId}
            />
          ) : (
            <p className="text-center text-sm text-sky-300">Waiting for game state...</p>
          )}
        </aside>
      </div>

      {isDiscarding && me && myDiscard != null && (
        <DiscardModal
          player={me}
          owed={myDiscard}
          onDiscard={discardCards}
          disabled={!isLive}
        />
      )}

      {isMainGame && activeOffer && iAmOfferRecipient && me && (
        <TradeOfferModal
          offer={activeOffer}
          sender={offerSender}
          recipient={me}
          onAccept={acceptTrade}
          onReject={rejectTrade}
          disabled={!isLive}
        />
      )}

      {pendingRobber && iMoveRobber && (
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
          onNewGame={leaveRoom}
          disabled={!isLive}
        />
      )}
    </main>
  );
}
