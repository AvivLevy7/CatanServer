import { useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import ZoomableBoard from './components/ZoomableBoard';
import RotateDeviceOverlay from './components/RotateDeviceOverlay';
import ActionDock from './components/ActionDock';
import DiceCinematic from './components/DiceCinematic';
import FullscreenButton from './components/FullscreenButton';
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
import { ExitIcon } from './components/icons';
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
    rollCinematic,
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
  // Offer the viewer chose to counter: the trade desk opens pre-filled with it (as recipient).
  const [counterOf, setCounterOf] = useState(null);

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
    else if (outcome === 'Countered') appendLog(`${nameOf(byPlayerId)} made a counter-offer.`, 'info');
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
  const lastRollTotal = (lastRoll?.roll ?? game?.lastRoll ?? null)?.total ?? null;

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

  // Side-dock affordances. The dock is icon-only, so every hint below is also its tooltip.
  const deckRemaining = game?.developmentCardsRemaining ?? null;
  const myResources = me?.resources ?? {};
  const canAffordDevCard =
    (myResources.Ore ?? 0) >= 1 && (myResources.Grain ?? 0) >= 1 && (myResources.Wool ?? 0) >= 1;
  const canRollNow = canAct && isMainGame && !hasRolled;
  const canBuyDev = canBuild && canAffordDevCard && deckRemaining !== 0;
  const waitingOn = currentPlayer?.name ?? 'the current player';

  const rollHint = isRolling
    ? 'Rolling...'
    : canRollNow
      ? 'Roll the dice'
      : !isMyTurn
        ? `Waiting for ${waitingOn}`
        : hasRolled
          ? 'You have already rolled this turn'
          : isMovingRobber || isDiscarding
            ? 'Settle the robber first'
            : isSetup
              ? 'Rolling starts after setup'
              : 'You cannot roll right now';
  const tradeHint = !isMainGame
    ? 'Trading opens in the main game'
    : !isMyTurn
      ? 'Wait for your turn'
      : !hasRolled
        ? 'Roll the dice first'
        : 'Trade with players, the bank or your ports';
  const buyHint =
    deckRemaining === 0
      ? 'The development deck is empty'
      : !canBuild
        ? 'Roll the dice before buying'
        : !canAffordDevCard
          ? 'Needs Ore + Wheat + Sheep'
          : `Buy a development card (Ore + Wheat + Sheep) — ${deckRemaining ?? '-'} left`;
  const endTurnHint = !isMyTurn
    ? `Waiting for ${waitingOn}`
    : !hasRolled
      ? 'You must roll before ending your turn'
      : 'End your turn';

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
    <main className="bg-tavern relative h-[100dvh] max-h-[100dvh] w-[100dvw] max-w-[100dvw] overflow-hidden text-parchment-100">
      {/* ---- Layer 0: the board IS the screen. Everything else floats over it. ---- */}
      <div
        aria-label="Board"
        className="board-backdrop fixed inset-0 z-0 h-[100dvh] w-[100dvw] touch-none overflow-hidden"
      >
        <ZoomableBoard padClass="px-6 pb-28 pt-[5.5rem] max-md:px-2 max-md:pb-20 max-md:pt-14">
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
      </div>

      <RotateDeviceOverlay />

      {/* ---- Top overlay: seats on the left of centre, room + clock + screen controls right ---- */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] max-md:gap-1">
        {game ? (
          <PlayerStatusBar
            players={players}
            currentTurnPlayerId={currentTurnPlayerId}
            myPlayerId={myPlayerId}
            largestArmyHolderId={game?.largestArmyHolderId}
            longestRoadHolderId={game?.longestRoadHolderId}
          />
        ) : (
          <p className="panel-glass pointer-events-auto rounded-lg px-3 py-1 text-xs italic text-parchment-300">
            Waiting for game state...
          </p>
        )}

        <div className="flex shrink-0 items-start gap-1.5 max-md:gap-1">
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
          <div
            className="panel-glass pointer-events-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-parchment-300/90 max-md:hidden"
            title={`${STATUS_LABELS[status] ?? status}${me ? ` — you are ${me.name}` : ''}`}
          >
            <span
              className={`inline-block size-2 shrink-0 rounded-full ${
                isLive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono font-bold tracking-widest text-amber-200">{room.roomId}</span>
          </div>
          <FullscreenButton />
          <button
            type="button"
            onClick={leaveRoom}
            title="Leave room"
            aria-label="Leave room"
            className="pointer-events-auto flex size-9 items-center justify-center rounded-lg border border-amber-700/50 bg-gray-900/85 text-parchment-100 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:border-rose-400 hover:text-rose-200 max-md:size-8"
          >
            <ExitIcon className="size-4.5 max-md:size-4" />
          </button>
        </div>
      </div>

      {/* ---- Centre-top stack: phase banner, errors, tile inspector ---- */}
      <div className="pointer-events-none fixed left-1/2 top-[calc(3.5rem+env(safe-area-inset-top))] z-20 flex w-[min(92vw,38rem)] -translate-x-1/2 flex-col items-center gap-1.5 max-md:top-[calc(2.75rem+env(safe-area-inset-top))] max-md:gap-1">
        <PhaseBanner
          game={game}
          currentPlayer={currentPlayer}
          robberMover={robberMover}
          isMyTurn={isMovingRobber || isDiscarding ? iMoveRobber : isMyTurn}
        />

        {actionError && (
          <button
            type="button"
            onClick={clearActionError}
            role="alert"
            className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-rose-400/60 bg-rose-950/90 px-3 py-1 text-xs font-medium text-rose-100 shadow-xl backdrop-blur"
          >
            <span className="truncate">{actionError}</span>
            <span aria-hidden="true" className="text-rose-300">&times;</span>
          </button>
        )}

        {selected && (
          <span className="pointer-events-none rounded-full border border-amber-700/50 bg-gray-900/85 px-2.5 py-0.5 text-[11px] italic text-parchment-200 shadow-lg backdrop-blur-md">
            {selected.type} / {RESOURCE_LABELS[selected.type]}
            {selected.numberToken ? ` / rolls on ${selected.numberToken}` : ''}
          </span>
        )}
      </div>

      {/* ---- Right dock: roll, trade, buy, end turn ---- */}
      <ActionDock
        onRoll={rollDice}
        canRoll={canRollNow}
        isRolling={isRolling}
        onTrade={() => setTradeOpenTurn(game?.turnNumber ?? 0)}
        canTrade={canBuild}
        onBuyDev={buyDevelopmentCard}
        canBuyDev={canBuyDev}
        deckRemaining={deckRemaining}
        lastTotal={lastRollTotal}
        onEndTurn={endTurn}
        canEndTurn={canAct && isMainGame && hasRolled}
        hasRolled={hasRolled}
        isMyTurn={isMyTurn}
        rollHint={rollHint}
        tradeHint={tradeHint}
        buyHint={buyHint}
        endTurnHint={endTurnHint}
      />

      {/* ---- Bottom: the viewer's own hand, centred over the board ---- */}
      {me && (
        <div className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 max-w-[96vw] -translate-x-1/2 max-md:bottom-[max(0.5rem,env(safe-area-inset-bottom))]">
          <CardHand
            player={me}
            onPlayDevCard={handlePlayCard}
            canPlay={canAct && isMainGame}
            deckRemaining={deckRemaining}
          />
        </div>
      )}

      {/* ---- Cinematic roll: huge dice take the centre of the screen ---- */}
      <DiceCinematic
        cinematic={rollCinematic}
        rolledByName={rollCinematic?.rolledBy != null ? nameOf(rollCinematic.rolledBy) : null}
      />

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

      {/* Counter-offer desk: a recipient re-drafts the live offer back to its proposer. */}
      {counterOf && activeOffer && counterOf.offerId === activeOffer.offerId && iAmOfferRecipient && me && (
        <TradeModal
          onClose={() => setCounterOf(null)}
          player={me}
          opponents={opponents}
          activeOffer={null}
          lastResult={null}
          onPropose={(target, give, get) => {
            setCounterOf(null);
            proposeTrade(activeOffer.senderPlayerId, give, get);
          }}
          onCancel={cancelTrade}
          onBankTrade={tradeWithBank}
          disabled={!isLive}
          counterTo={{
            offer: activeOffer,
            senderName: offerSender?.name ?? 'the proposer',
          }}
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

      {isMainGame && activeOffer && iAmOfferRecipient && me && !(counterOf && counterOf.offerId === activeOffer.offerId) && (
        <TradeOfferModal
          offer={activeOffer}
          sender={offerSender}
          recipient={me}
          onAccept={acceptTrade}
          onReject={rejectTrade}
          onCounter={() => setCounterOf(activeOffer)}
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
