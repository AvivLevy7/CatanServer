import { useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import ZoomableBoard from './components/ZoomableBoard';
import RotateDeviceOverlay from './components/RotateDeviceOverlay';
import DicePanel from './components/DicePanel';
import CardHand from './components/CardHand';
import SideDrawer from './components/SideDrawer';
import { MonopolyModal, YearOfPlentyModal } from './components/DevCardModals';
import DiscardModal from './components/DiscardModal';
import GameOverOverlay from './components/GameOverOverlay';
import PhaseBanner from './components/PhaseBanner';
import PlayerStatusBar from './components/PlayerStatusBar';
import StealPicker from './components/StealPicker';
import TradeModal from './components/TradeModal';
import { describeBundle } from './resources';
import TradeOfferModal from './components/TradeOfferModal';
import TurnTimer from './components/TurnTimer';
import { LandingPage, WaitingRoom } from './components/Lobby';
import { useGameHub } from './useGameHub';
import { BTN_GHOST } from './theme';
import { sound } from './audio';

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
    <main className="bg-tavern flex h-[100dvh] min-h-[100dvh] w-[100dvw] flex-col items-center justify-center gap-4 overflow-hidden p-[max(1.5rem,env(safe-area-inset-top))_max(1.5rem,env(safe-area-inset-right))_max(1.5rem,env(safe-area-inset-bottom))_max(1.5rem,env(safe-area-inset-left))] text-center">
      {!isError && (
        <span
          className="size-10 animate-spin rounded-full border-4 border-amber-900/60 border-t-amber-300"
          role="status"
          aria-label="Connecting"
        />
      )}
      <p className="font-display text-lg font-semibold tracking-wide text-parchment-100">
        {STATUS_LABELS[status] ?? status}
      </p>
      {isError && (
        <p className="max-w-sm text-sm text-parchment-300">
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
    restartGame,
    restartCount,
    systemMessage,
    isRolling,
    placeInitialSettlement,
    placeInitialRoad,
    startGame,
    addBot,
    removeBot,
    chatMessages,
    sendChat,
  } = useGameHub();
  const [selected, setSelected] = useState(null);
  // Robber destination awaiting a steal-target choice.
  const [pendingRobber, setPendingRobber] = useState(null);
  // Action card awaiting its choice modal: { type, cardId }.
  const [pendingCard, setPendingCard] = useState(null);
  // Turn number the trade desk was opened on; it closes itself when the turn moves on.
  const [tradeOpenTurn, setTradeOpenTurn] = useState(null);

  // Browsers gate audio behind a user gesture: unlock on the first one.
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  // Client-side game log built from hub events.
  const [log, setLog] = useState([]);
  const logSeq = useRef(0);
  const appendLog = (text, tone = 'info') =>
    setLog((prev) => [...prev.slice(-99), { id: ++logSeq.current, text, tone }]);

  const nameOf = (id) => game?.players?.find((p) => p.id === id)?.name ?? 'Someone';

  // New round: wipe the log so the previous game's history does not bleed through.
  useEffect(() => {
    if (restartCount > 0) setLog([{ id: ++logSeq.current, text: 'A new game has started.', tone: 'good' }]);
  }, [restartCount]);

  useEffect(() => {
    if (!lastRoll) return;
    appendLog(`${nameOf(lastRoll.rolledBy)} rolled ${lastRoll.roll?.total ?? lastRoll.roll}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRoll]);

  useEffect(() => {
    if (!lastTradeResult) return;
    const { outcome, byPlayerId } = lastTradeResult;
    if (outcome === 'Accepted') appendLog(`Trade accepted by ${nameOf(byPlayerId)}.`, 'good');
    else if (outcome === 'Rejected') appendLog('Trade offer declined.', 'bad');
    else if (outcome === 'Cancelled') appendLog('Trade offer withdrawn.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTradeResult]);

  const offerForLog = game?.activeTradeOffer ?? null;
  useEffect(() => {
    if (!offerForLog) return;
    appendLog(
      `${nameOf(offerForLog.senderPlayerId)} offers ${describeBundle(offerForLog.resourcesOffered)} for ${describeBundle(
        offerForLog.resourcesRequested,
      )}${offerForLog.targetPlayerId ? ` to ${nameOf(offerForLog.targetPlayerId)}` : ''}.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerForLog?.offerId]);

  const turnForLog = game?.currentTurnPlayerId ?? null;
  useEffect(() => {
    if (!turnForLog) return;
    appendLog(`${nameOf(turnForLog)}'s turn.`);
    if (turnForLog === myPlayerId) sound.play('turn');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnForLog]);

  useEffect(() => {
    if (actionError) appendLog(actionError, 'bad');
  }, [actionError]);

  useEffect(() => {
    if (systemMessage) appendLog(systemMessage.text, systemMessage.tone ?? 'info');
  }, [systemMessage]);

  const lastChat = chatMessages[chatMessages.length - 1] ?? null;
  useEffect(() => {
    if (lastChat && lastChat.senderId !== myPlayerId) sound.play('chat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastChat?.id]);

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
        onAddBot={addBot}
        onRemoveBot={removeBot}
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
  // Nothing is actionable while the dice are tumbling, even dev cards.
  const canAct = isLive && isMyTurn && !isRolling;
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
    <main className="bg-tavern flex h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-[100dvw] max-w-[100dvw] flex-col overflow-hidden px-safe pb-safe pt-safe text-parchment-100">
      <RotateDeviceOverlay />
      {/* ---- Top: title strip + player status bar (flex-none) ---- */}
      <header className="flex flex-none flex-col gap-0.5 px-2 pr-14 pt-0.5 max-md:gap-0 max-md:px-1 max-md:pr-12">
        <div className="flex items-center justify-between gap-3 max-md:hidden">
          <h1 className="font-display text-sm font-black tracking-[0.3em] text-transparent bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 bg-clip-text drop-shadow-[0_2px_12px_rgba(245,190,90,0.35)]">
            CATAN
          </h1>
          <p className="flex min-w-0 flex-nowrap items-center justify-end gap-2 overflow-hidden whitespace-nowrap text-[11px] text-parchment-300/80">
            <span
              className={`inline-block size-2 rounded-full ${
                isLive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'
              }`}
            />
            {STATUS_LABELS[status] ?? status}
            <span aria-hidden="true">&middot;</span>
            Room <span className="font-mono font-bold text-amber-200">{room.roomId}</span>
            {me && (
              <>
                <span aria-hidden="true">&middot;</span>
                You are <span className="font-display font-semibold text-parchment-50">{me.name}</span>
              </>
            )}
            <span aria-hidden="true">&middot;</span>
            <span className="italic">
              {selected
                ? `${selected.type} / ${RESOURCE_LABELS[selected.type]}${
                    selected.numberToken ? ` / rolls on ${selected.numberToken}` : ''
                  }`
                : 'Select a tile to inspect it'}
            </span>
            {actionError && (
              <button
                type="button"
                onClick={clearActionError}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-400/50 bg-rose-950/80 px-2 py-0.5 text-xs font-medium text-rose-100 shadow-lg backdrop-blur"
                role="alert"
              >
                {actionError}
                <span aria-hidden="true" className="text-rose-300">&times;</span>
              </button>
            )}
          </p>
        </div>

        {game ? (
          <PlayerStatusBar
            players={players}
            currentTurnPlayerId={currentTurnPlayerId}
            myPlayerId={myPlayerId}
            largestArmyHolderId={game?.largestArmyHolderId}
            longestRoadHolderId={game?.longestRoadHolderId}
            timer={
              <TurnTimer
                deadline={game?.turnDeadline}
                label={
                  isMovingRobber || isDiscarding
                    ? 'Robber clock'
                    : isMyTurn
                      ? 'Your clock'
                      : `${currentPlayer?.name ?? 'Turn'} clock`
                }
              />
            }
          />
        ) : (
          <p className="text-center text-sm italic text-parchment-300">Waiting for game state...</p>
        )}
      </header>

      {/* ---- Middle: board (flex-1 min-h-0) with phase/dice rail alongside ---- */}
      <div className="flex min-h-0 w-full flex-1 gap-1 px-1 pr-14 pt-0.5 max-md:px-0.5 max-md:pr-12 max-md:pt-0">
        <section
          aria-label="Board"
          className="flex min-h-0 min-w-0 w-full flex-1 touch-none items-center justify-center overflow-hidden rounded-2xl border border-amber-800/40 bg-gradient-to-b from-sky-950/70 to-ink-900/70 p-1 shadow-2xl shadow-black/60 backdrop-blur-sm max-md:rounded-lg max-md:p-0"
        >
          <ZoomableBoard>
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
              interactive={!isRolling && (iMoveRobber || (canAct && (isSetup || isPlacingFreeRoads || canBuild)))}
            />
          </ZoomableBoard>
        </section>

        <aside className="flex min-h-0 w-44 flex-none flex-col gap-1 overflow-x-hidden overflow-y-auto max-md:w-32 max-md:gap-0.5">
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
            isRolling={isRolling}
          />
          <div className="flex-none overflow-hidden p-0.5">
            <button type="button" onClick={leaveRoom} className={`${BTN_GHOST} w-full px-3 py-1 text-xs hover:scale-100`}>
              Leave room
            </button>
          </div>
        </aside>
      </div>

      {/* ---- Bottom: action bar + card hand (flex-none) ---- */}
      <div className="flex w-full flex-none items-end gap-1 px-1 pb-1 pr-14 pt-0.5 max-md:gap-0.5 max-md:px-0.5 max-md:pb-0.5 max-md:pr-12 max-md:pt-0">
        {/* Action bar */}
        <section aria-label="Actions" className="panel-glass flex w-36 flex-none flex-col items-stretch gap-1 p-1.5 max-md:w-28 max-md:p-1">
          <button
            type="button"
            onClick={() => setTradeOpenTurn(game?.turnNumber ?? 0)}
            disabled={!canBuild}
            title={!isMainGame ? 'Trading opens in the main game' : !isMyTurn ? 'Wait for your turn' : !hasRolled ? 'Roll the dice first' : 'Trade with players, the bank or your ports'}
            className="group relative overflow-hidden rounded-md border border-amber-300/60 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 px-3 py-1 font-display text-xs font-black uppercase tracking-[0.25em] text-ink-900 shadow-[0_0_14px_rgba(245,190,90,0.35)] ring-1 ring-amber-100/70 transition-all hover:brightness-110 hover:shadow-[0_0_22px_rgba(245,190,90,0.6)] disabled:cursor-not-allowed disabled:opacity-40 max-md:px-2 max-md:py-0.5 max-md:text-[10px] max-md:tracking-[0.15em]"
          >
            <span className="relative z-10">Trade</span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden="true" />
          </button>
          <p className="truncate text-center text-[10px] italic leading-snug text-parchment-300/80 max-md:hidden">
            {activeOffer && activeOffer.senderPlayerId === myPlayerId
              ? 'Your offer is on the table.'
              : isMainGame && isMyTurn
                ? hasRolled
                  ? 'Click the board to build.'
                  : 'Roll the dice to begin.'
                : isMainGame
                  ? `Waiting for ${currentPlayer?.name ?? 'the current player'}.`
                  : 'Setup phase: place your pieces.'}
          </p>
        </section>

        {/* Hand */}
        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          {me && (
            <CardHand
              player={me}
              onPlayDevCard={handlePlayCard}
              onBuyDevCard={buyDevelopmentCard}
              canBuy={canBuild}
              canPlay={canAct && isMainGame}
              deckRemaining={game?.developmentCardsRemaining}
            />
          )}
        </div>
      </div>

      <SideDrawer
        log={log}
        chatMessages={chatMessages}
        players={players}
        myPlayerId={myPlayerId}
        onSendChat={sendChat}
        frequencies={game?.diceRollFrequencies}
        disabled={!isLive}
      />

      {tradeOpenTurn != null && tradeOpenTurn === (game?.turnNumber ?? 0) && isMainGame && isMyTurn && me && (
        <TradeModal
          onClose={() => setTradeOpenTurn(null)}
          player={me}
          opponents={opponents}
          activeOffer={activeOffer}
          lastResult={lastTradeResult}
          onPropose={proposeTrade}
          onCancel={cancelTrade}
          onBankTrade={tradeWithBank}
          disabled={!canBuild}
        />
      )}

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
          diceFrequencies={game?.diceRollFrequencies}
          isHost={room.hostPlayerId === myPlayerId}
          onPlayAgain={restartGame}
          onNewGame={leaveRoom}
          disabled={!isLive}
        />
      )}
    </main>
  );
}
