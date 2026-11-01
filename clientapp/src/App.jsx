import { useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import ZoomableBoard from './components/ZoomableBoard';
import RotateDeviceOverlay from './components/RotateDeviceOverlay';
import ActionDock from './components/ActionDock';
import AudioControls from './components/AudioControls';
import DiceCinematic from './components/DiceCinematic';
import FullscreenButton from './components/FullscreenButton';
import CardHand from './components/CardHand';
import SideDrawer from './components/SideDrawer';
import { MonopolyModal, YearOfPlentyModal } from './components/DevCardModals';
import BuildMenu from './components/BuildMenu';
import DiscardModal from './components/DiscardModal';
import MiniLog, { MINI_LOG_LIFE_MS } from './components/MiniLog';
import OfferStatusPanel from './components/OfferStatusPanel';
import WishlistTag from './components/WishlistTag';
import { tradeStatusOf } from './tradeStatus';
import EmoteBubbleLayer from './components/EmoteBubbleLayer';
import EmoteWheel from './components/EmoteWheel';
import FlyingResources from './components/FlyingResources';
import MonopolyDrain from './components/MonopolyDrain';
import UndoBuildButton from './components/UndoBuildButton';
import GameOverOverlay from './components/GameOverOverlay';
import PhaseBanner from './components/PhaseBanner';
import PlayerStatusBar from './components/PlayerStatusBar';
import SevenVignette from './components/SevenVignette';
import StealPicker from './components/StealPicker';
import BlindStealOverlay from './components/BlindStealOverlay';
import TradeModal from './components/TradeModal';
import { describeBundle } from './resources';
import TradeOfferPanel from './components/TradeOfferPanel';
import TurnTimer from './components/TurnTimer';
import { LandingPage, WaitingRoom } from './components/Lobby';
import { useGameHub } from './useGameHub';
import { usePlacementImpact } from './usePlacementImpact';
import { BUILD_BY_ID, canAfford } from './buildCosts';
import { useRoadClaim } from './useRoadClaim';
import { useMiniLog } from './useMiniLog';
import { ArrowRightIcon, ExitIcon, HammerIcon } from './components/icons';
import { sound } from './audio';
import { music } from './music';
import { haptics } from './haptics';
import { RESOURCE_STYLE } from './theme';

const RESOURCE_LABELS = {
  Forest: 'Lumber',
  Pasture: 'Wool',
  Fields: 'Grain',
  Hills: 'Brick',
  Mountains: 'Ore',
  Desert: 'None',
};

// Remembers the "do not disturb" seat preference across reloads.
const BLOCK_TRADES_KEY = 'catan.blockTrades';

// How long the rolled number's hexes stay lit after a roll resolves.
const HEX_HIGHLIGHT_MS = 1500;

// At most this many icons fly per grant, so a city on a double hex does not spray the screen.
const MAX_FLIGHT_ICONS_PER_GRANT = 3;

// Costs are shared with the build menu and the "ask for what I'm missing" shortcut; the
// server remains the only authority on whether a build is actually legal.
const BUILD_COSTS = Object.fromEntries(
  Object.entries(BUILD_BY_ID).map(([id, build]) => [id, build.cost]),
);

/** A resource bundle as bare glyphs, for the icon-only feed. */
const glyphsFor = (bundle) =>
  Object.entries(bundle ?? {})
    .filter(([, amount]) => amount > 0)
    .flatMap(([key, amount]) => Array.from({ length: amount }, () => RESOURCE_STYLE[key]?.glyph ?? '?'))
    .join('');

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
    <main className="bg-tavern lobby-stage relative flex h-[100dvh] min-h-[100dvh] w-[100dvw] flex-col items-center justify-center gap-4 overflow-hidden p-[max(1.5rem,env(safe-area-inset-top))_max(1.5rem,env(safe-area-inset-right))_max(1.5rem,env(safe-area-inset-bottom))_max(1.5rem,env(safe-area-inset-left))] text-center">
      <div className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-10">
        <AudioControls />
      </div>
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
    resumable,
    resumeSession,
    dismissResumable,
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
    undoBuild,
    monopoly,
    clearMonopoly,
    startGame,
    addBot,
    removeBot,
    chatMessages,
    sendChat,
    emotes,
    sendEmote,
    negotiators,
    setNegotiationStatus,
    sevenPulse,
    lastRobbery,
    confirmTrade,
    wishlists,
    setTradeWishlist,
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
  // The rolled number's hexes, lit for a beat after the roll resolves: { id, hexIds }.
  const [producingRoll, setProducingRoll] = useState(null);
  // One roll's payout in flight: { id, flights }.
  const [flightBurst, setFlightBurst] = useState(null);
  // Victim chosen, now picking a face-down card: { hexId, victimId, priorRobbery }.
  const [pendingSteal, setPendingSteal] = useState(null);
  // Build palette open state, and the cost bundle its hovered row is previewing.
  const [buildMenuOpen, setBuildMenuOpen] = useState(false);
  const [buildPreview, setBuildPreview] = useState(null);
  // A build the player has chosen and is now placing on the board. Keeps its cards lifted
  // the whole time, so the price stays visible while they pick a spot.
  const [armedBuild, setArmedBuild] = useState(null);
  // Cards the player was short of, carried into the trade desk's "requesting" side.
  const [tradePrefill, setTradePrefill] = useState(null);
  // Do not disturb: incoming offers are declined on arrival instead of asking.
  const [blockTrades, setBlockTrades] = useState(() => localStorage.getItem(BLOCK_TRADES_KEY) === '1');
  const toggleBlockTrades = () =>
    setBlockTrades((on) => {
      localStorage.setItem(BLOCK_TRADES_KEY, on ? '0' : '1');
      return !on;
    });

  // Browsers gate audio behind a user gesture: unlock on the first one. The background
  // music starts on the same gesture (and only if it was left switched on).
  useEffect(() => {
    const unlock = () => {
      sound.unlock();
      music.unlock();
    };
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

  // Trades: the proposer waits; only a recipient the offer is addressed to may answer it.
  const activeOffer = game?.activeTradeOffer ?? null;
  const iAmOfferRecipient =
    !!activeOffer &&
    activeOffer.senderPlayerId !== myPlayerId &&
    (activeOffer.targetPlayerId == null || activeOffer.targetPlayerId === myPlayerId) &&
    !(activeOffer.declinedBy ?? []).includes(myPlayerId);

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

  useEffect(() => {
    if (!activeOffer) return;
    appendLog(
      `${nameOf(activeOffer.senderPlayerId)} offers ${describeBundle(activeOffer.resourcesOffered)} for ${describeBundle(
        activeOffer.resourcesRequested,
      )}${activeOffer.targetPlayerId ? ` to ${nameOf(activeOffer.targetPlayerId)}` : ''}.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOffer?.offerId]);

  // Do not disturb: turn an incoming offer away at once so the proposer is not left waiting.
  useEffect(() => {
    if (!blockTrades || !activeOffer || !iAmOfferRecipient) return;
    rejectTrade(activeOffer.offerId);
    appendLog(`Offer from ${nameOf(activeOffer.senderPlayerId)} turned away (do not disturb).`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockTrades, activeOffer?.offerId, iAmOfferRecipient]);

  const turnForLog = game?.currentTurnPlayerId ?? null;
  useEffect(() => {
    if (!turnForLog) return;
    appendLog(`${nameOf(turnForLog)}'s turn.`);
    if (turnForLog === myPlayerId) {
      sound.play('turn');
      // Two short taps: the phone in your pocket telling you the table is waiting.
      haptics.play('turn');
    }
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

  // ---- Game juice. These run before the routing returns below, so the hook order is
  // ---- identical on every render whatever screen is showing. ----

  // Freshest board: GameState carries node/edge ownership, BoardState is the fallback.
  const juiceHexes = game?.board?.hexes ?? board?.hexes;
  const juiceNodes = game?.board?.nodes ?? board?.nodes;
  const juiceEdges = game?.board?.edges ?? board?.edges;

  // Pieces that landed on the board within the last beat, from diffing server snapshots -
  // so every seat sees every placement, bots included.
  const placementImpact = usePlacementImpact(juiceNodes, juiceEdges, restartCount);

  // The Longest Road trail to light up, for the couple of seconds after it changes hands.
  const roadClaimPath = useRoadClaim(
    game?.longestRoadHolderId ?? null,
    game?.longestRoadPath,
    restartCount,
  );

  // Glanceable feed of the last few events, in icons rather than sentences.
  const miniLog = useMiniLog(MINI_LOG_LIFE_MS);

  // Where the camera should look: a piece someone *else* has just put down. The board
  // decides whether it is worth moving for (see ZoomableBoard) - a piece already in
  // comfortable view does not drag the camera about. Own placements are skipped: the
  // player is looking at the spot they just tapped.
  const [cameraFocus, setCameraFocus] = useState(null);
  const focusSeq = useRef(0);
  useEffect(() => {
    if (placementImpact.nodes.size === 0 && placementImpact.edges.size === 0) return;

    const node = (juiceNodes ?? []).find(
      (n) => placementImpact.nodes.has(n.id) && n.ownerId != null && n.ownerId !== myPlayerId,
    );
    const edge = node
      ? null
      : (juiceEdges ?? []).find(
          (e) => placementImpact.edges.has(e.id) && e.ownerId != null && e.ownerId !== myPlayerId,
        );
    if (!node && !edge) return;

    setCameraFocus({
      id: ++focusSeq.current,
      selector: node ? `[data-node-id="${node.id}"]` : `[data-edge-id="${edge.id}"]`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementImpact]);

  // A roll resolving lights the matching hexes and sends their goods flying to whoever
  // collected them. Both are keyed off a monotonic id so a fast follow-up roll cannot
  // have its highlight cleared by the previous roll's timer.
  const rollSeq = useRef(0);
  useEffect(() => {
    if (!lastRoll) return undefined;
    const total = lastRoll.roll?.total ?? lastRoll.roll ?? null;
    const id = ++rollSeq.current;

    const flights = [];
    for (const grant of lastRoll.production ?? []) {
      if (!grant?.hexId) continue;
      const copies = Math.max(1, Math.min(grant.amount ?? 1, MAX_FLIGHT_ICONS_PER_GRANT));
      for (let i = 0; i < copies; i++) {
        flights.push({
          key: `${id}-${flights.length}`,
          resource: grant.resource,
          hexId: grant.hexId,
          playerId: grant.playerId,
          playerName: nameOf(grant.playerId),
          isMe: grant.playerId === myPlayerId,
        });
      }
    }
    setFlightBurst(flights.length > 0 ? { id, flights } : null);

    // A 7 produces nothing, and gets the vignette instead of a warm glow.
    if (total == null || total === 7) return undefined;

    // Every tile bearing the rolled number, minus any the robber is sitting on: that one
    // pays nobody, so lighting it would be a lie.
    const hexIds = new Set(
      (juiceHexes ?? [])
        .filter((hex) => hex.numberToken === total && !hex.hasRobber)
        .map((hex) => hex.id),
    );
    if (hexIds.size === 0) return undefined;

    setProducingRoll({ id, hexIds });
    const timer = setTimeout(
      () => setProducingRoll((current) => (current?.id === id ? null : current)),
      HEX_HIGHLIGHT_MS,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRoll]);

  // Rolls, in the feed as a die and a number.
  useEffect(() => {
    if (!lastRoll) return;
    const total = lastRoll.roll?.total ?? lastRoll.roll ?? null;
    if (total == null) return;
    miniLog.push({
      playerId: lastRoll.rolledBy,
      playerName: nameOf(lastRoll.rolledBy),
      parts: (
        <>
          <span aria-hidden="true">{'\u{1F3B2}'}</span>
          <span className={`font-display font-black tabular-nums ${total === 7 ? 'text-rose-300' : ''}`}>
            {total}
          </span>
        </>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRoll]);

  // Completed trades, as the two bundles passing each other. The terms ride along on the
  // resolution event, because by the time it lands the offer itself has been cleared.
  useEffect(() => {
    if (lastTradeResult?.outcome !== 'Confirmed') return;
    const terms = lastTradeResult.offer;
    if (!terms) return;
    miniLog.push({
      playerId: terms.senderPlayerId,
      playerName: nameOf(terms.senderPlayerId),
      parts: (
        <>
          <span aria-hidden="true">{glyphsFor(terms.resourcesOffered)}</span>
          <ArrowRightIcon className="size-3.5 shrink-0 text-amber-300" />
          <span aria-hidden="true">{glyphsFor(terms.resourcesRequested)}</span>
          <span className="truncate font-display text-[10px] font-bold">
            {nameOf(lastTradeResult.byPlayerId)}
          </span>
        </>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTradeResult]);

  // Buildings going up, from the same diff that drives the placement animation.
  const lastImpact = useRef({ nodes: 0, edges: 0 });
  useEffect(() => {
    const nodeCount = placementImpact.nodes.size;
    const edgeCount = placementImpact.edges.size;
    const grew = nodeCount > lastImpact.current.nodes || edgeCount > lastImpact.current.edges;
    lastImpact.current = { nodes: nodeCount, edges: edgeCount };
    if (!grew) return;

    const builderId =
      (juiceNodes ?? []).find((n) => placementImpact.nodes.has(n.id))?.ownerId ??
      (juiceEdges ?? []).find((e) => placementImpact.edges.has(e.id))?.ownerId ??
      null;
    if (builderId == null) return;

    miniLog.push({
      playerId: builderId,
      playerName: nameOf(builderId),
      parts: <HammerIcon className="size-3.5 text-amber-200" />,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementImpact]);

  // A new round clears the feed with everything else.
  useEffect(() => {
    if (restartCount > 0) miniLog.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartCount]);

  // Tell the table when this seat is reading an offer or drafting a counter. Only
  // transitions are sent, so the hub is not spammed on every unrelated re-render.
  const lastNegotiationRef = useRef('None');
  const counterDeskOpen = !!(counterOf && activeOffer && counterOf.offerId === activeOffer.offerId && iAmOfferRecipient);
  const inspectingOffer = !!(game?.phase === 'MainGame' && activeOffer && iAmOfferRecipient && !blockTrades);
  useEffect(() => {
    const activity = counterDeskOpen ? 'Countering' : inspectingOffer ? 'Inspecting' : 'None';
    if (activity === lastNegotiationRef.current) return;
    lastNegotiationRef.current = activity;
    setNegotiationStatus(activity);
  }, [counterDeskOpen, inspectingOffer, setNegotiationStatus]);

  // Escape drops an armed build without placing it.
  useEffect(() => {
    if (!armedBuild) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setArmedBuild(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armedBuild]);

  const isLive = status === 'connected';

  // Wait for the socket, then route: no room -> landing, lobby -> waiting room, in game -> board.
  if (status === 'connecting' || status === 'error' || status === 'disconnected') {
    return <StatusScreen status={status} error={error} />;
  }

  // The audio widget rides along on every screen, so the music can be turned down
  // before the game even starts.
  const withAudio = (screen) => (
    <>
      {screen}
      <div className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-40">
        <AudioControls />
      </div>
    </>
  );

  if (!room || !session) {
    return withAudio(
      <LandingPage
        onCreate={createRoom}
        onJoin={joinRoom}
        disabled={!isLive}
        error={actionError}
        resumable={resumable}
        onResume={resumeSession}
        onDismissResume={dismissResumable}
      />,
    );
  }

  if (room.status !== 'InGame') {
    return withAudio(
      <WaitingRoom
        room={room}
        myPlayerId={session.playerId}
        onStart={startGame}
        onLeave={leaveRoom}
        onAddBot={addBot}
        onRemoveBot={removeBot}
        disabled={!isLive}
      />,
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

  // Who still has a socket. The lobby state tracks it (bots always count as present),
  // and the seat cards grey out whoever has dropped.
  const connections = Object.fromEntries((room.players ?? []).map((p) => [p.id, p.isConnected !== false]));

  // A build of mine that is still inside its take-back window. The field is public - the
  // whole table saw the piece go down - but only its owner is offered the undo.
  const myUndoableBuild =
    game?.undoableBuild?.playerId === myPlayerId ? game.undoableBuild : null;

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

  // Can this seat still do anything but end the turn? Costs and piece stock are checked
  // here (and a city needs a settlement of one's own to upgrade); whether a legal spot
  // exists for a road or settlement is left to the server, which rejects bad placements
  // anyway. Being slightly generous is the safe direction: a false "you are stuck" is far
  // worse than missing a nudge.
  const myUnplayedDevCards = (me?.developmentCards ?? []).filter((c) => !c.isPlayed);
  const iOwnASettlement = (liveBoard.nodes ?? []).some(
    (node) => node.building === 'Settlement' && node.ownerId === myPlayerId,
  );
  const couldStillBuild =
    (canAfford(myResources, BUILD_COSTS.road) && (me?.roadsRemaining ?? 0) > 0) ||
    (canAfford(myResources, BUILD_COSTS.settlement) && (me?.settlementsRemaining ?? 0) > 0) ||
    (canAfford(myResources, BUILD_COSTS.city) && (me?.citiesRemaining ?? 0) > 0 && iOwnASettlement) ||
    (canAfford(myResources, BUILD_COSTS.developmentCard) && deckRemaining !== 0);
  const couldStillPlayACard = myUnplayedDevCards.some(
    (card) => card.canPlayNow && card.type !== 'VictoryPoint',
  );
  // The nudge is held back while an offer of theirs is live - they are waiting on an
  // answer, not stalling - and while a modal still owes them a decision.
  const nothingLeftToDo =
    canAct && isMainGame && hasRolled && !couldStillBuild && !couldStillPlayACard && !activeOffer;

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
      : nothingLeftToDo
        ? 'Nothing left to build or play - end your turn'
        : 'End your turn';

  // Discards: only this tab's own debt is shown here.
  const pendingDiscards = game?.pendingDiscards ?? {};
  const myDiscard = myPlayerId != null ? pendingDiscards[myPlayerId] ?? null : null;

  const offerSender = players.find((p) => p.id === activeOffer?.senderPlayerId) ?? null;
  const opponents = players.filter((p) => p.id !== myPlayerId);

  // My own live offer, which I now have to close myself by picking a partner.
  const myLiveOffer = activeOffer?.senderPlayerId === myPlayerId ? activeOffer : null;

  // Where every seat stands on the live offer, for the badges on the top chips.
  const tradeStatuses = Object.fromEntries(
    players.map((p) => [p.id, tradeStatusOf({ playerId: p.id, offer: activeOffer, negotiators })]),
  );

  // Harbour conversions are a bank trade, so they follow the same rules as one.
  const myWishlist = wishlists[myPlayerId] ?? {};

  const openTradeDeskFor = (missing) => {
    setTradePrefill(missing && Object.keys(missing).length > 0 ? missing : null);
    setTradeOpenTurn(game?.turnNumber ?? 0);
  };

  // A build the player can pay for enters placement mode (the board is the control for
  // road/settlement/city); one they cannot opens the trade desk asking for the difference.
  const handleBuildChoice = (buildId) => {
    if (buildId === 'developmentCard') {
      setArmedBuild(null);
      buyDevelopmentCard();
      return;
    }
    // Roads, settlements and cities are placed by clicking the board, so choosing one here
    // arms it: the banner says where to click and the cards that will pay stay raised.
    setSelected(null);
    setArmedBuild(buildId);
  };


  // Cards to hold up: whatever the menu is hovering, else whatever is armed.
  const earmarkedCards = buildPreview ?? (armedBuild ? BUILD_COSTS[armedBuild] : null);

  const handleNodeClick = (node) => {
    if (!canAct) return;
    if (isSetup) {
      if (node.building === 'None') placeInitialSettlement(node.id);
      return;
    }
    if (!isMainGame) return;
    if (!hasRolled) return;

    if (node.building === 'None') {
      setArmedBuild(null);
      buildSettlement(node.id);
    } else if (node.building === 'Settlement' && node.ownerId === myPlayerId) {
      setArmedBuild(null);
      buildCity(node.id);
    }
  };

  const handleEdgeClick = (edge) => {
    if (!canAct) return;
    if (edge.ownerId != null) return;
    if (isSetup) {
      placeInitialRoad(edge.id);
    } else if (isPlacingFreeRoads || (isMainGame && hasRolled)) {
      setArmedBuild(null);
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
      // Nobody to rob: the robber just moves.
      moveRobber(tile.id, null);
    } else if (candidateIds.length === 1) {
      // Only one neighbour, so skip the chooser and go straight to their hand.
      openBlindSteal(tile.id, candidateIds[0]);
    } else {
      setPendingRobber({ hexId: tile.id, candidateIds });
    }
  };

  // Remembering the robbery event that was current when the hand opens is what lets the
  // overlay tell "the server has answered my steal" from "a steal happened earlier".
  const openBlindSteal = (hexId, victimId) =>
    setPendingSteal({ hexId, victimId, priorRobbery: lastRobbery });

  const handleStealPick = (victimId) => {
    const { hexId } = pendingRobber;
    setPendingRobber(null);
    openBlindSteal(hexId, victimId);
  };

  // The card the thief turned over, but only for the robbery their own pick caused.
  const stealVictim = players.find((p) => p.id === pendingSteal?.victimId) ?? null;
  const revealedSteal =
    pendingSteal && lastRobbery && lastRobbery !== pendingSteal.priorRobbery && lastRobbery.hexId === pendingSteal.hexId
      ? lastRobbery.stolenResource ?? null
      : null;

  return (
    <main className="bg-tavern relative h-[100dvh] max-h-[100dvh] w-[100dvw] max-w-[100dvw] overflow-hidden text-parchment-100">
      {/* ---- Layer 0: the board IS the screen. Everything else floats over it. ---- */}
      <div
        aria-label="Board"
        className="board-backdrop ocean-alive fixed inset-0 z-0 h-[100dvh] w-[100dvw] touch-none overflow-hidden"
      >
        <ZoomableBoard
          padClass="px-6 pb-28 pt-[7rem] max-md:px-2 max-md:pb-20 max-md:pt-[4.5rem]"
          focus={cameraFocus}
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
            interactive={!isRolling && (iMoveRobber || (canAct && (isSetup || isPlacingFreeRoads || canBuild)))}
            producingHexIds={producingRoll?.hexIds}
            placedNodeIds={placementImpact.nodes}
            placedEdgeIds={placementImpact.edges}
            roadClaimPath={roadClaimPath}
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
            pendingDiscards={pendingDiscards}
            negotiators={negotiators}
            wishlists={wishlists}
            tradeStatuses={tradeStatuses}
            connections={connections}
          />
        ) : (
          <p className="panel-glass pointer-events-auto rounded-lg px-3 py-1 text-xs italic text-parchment-300">
            Waiting for game state...
          </p>
        )}

        <div className="flex shrink-0 items-start gap-1.5 max-md:gap-1">
          <TurnTimer
            deadline={game?.turnDeadline}
            total={game?.turnClockSeconds || 60}
            extended={game?.turnDeadlineExtended === true}
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
          <AudioControls />
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
      <div className="pointer-events-none fixed left-1/2 top-[calc(4.75rem+env(safe-area-inset-top))] z-20 flex w-[min(92vw,38rem)] -translate-x-1/2 flex-col items-center gap-1.5 max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:gap-1">
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

        {/* Armed build: say where to click, and offer a way out that is not the keyboard. */}
        {armedBuild && BUILD_BY_ID[armedBuild] && (
          <button
            type="button"
            onClick={() => setArmedBuild(null)}
            className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-emerald-300/70 bg-emerald-900/90 px-3 py-1 text-xs font-semibold text-emerald-50 shadow-xl backdrop-blur"
          >
            <span className="truncate">
              {BUILD_BY_ID[armedBuild].label}: {BUILD_BY_ID[armedBuild].hint}
            </span>
            <span aria-hidden="true" className="text-emerald-300">&times;</span>
            <span className="sr-only">Cancel this build</span>
          </button>
        )}

        {/* Misclicked a road or settlement? A few seconds to put it back. */}
        {myUndoableBuild && (
          <UndoBuildButton undoable={myUndoableBuild} onUndo={undoBuild} disabled={!isLive} />
        )}

        {selected && (
          <span className="pointer-events-none rounded-full border border-amber-700/50 bg-gray-900/85 px-2.5 py-0.5 text-[11px] italic text-parchment-200 shadow-lg backdrop-blur-md">
            {selected.type} / {RESOURCE_LABELS[selected.type]}
            {selected.numberToken ? ` / rolls on ${selected.numberToken}` : ''}
          </span>
        )}
      </div>

      {/* ---- Right dock: roll, trade, buy, end turn ---- */}
      {/* Build palette, wanted/for-sale notice and the glanceable feed. */}
      <div className="pointer-events-none fixed right-3 top-[calc(50%+9.5rem)] z-30 max-md:right-[max(0.375rem,env(safe-area-inset-right))] max-md:top-[calc(50%+7.5rem)]">
        <BuildMenu
          open={buildMenuOpen}
          onOpenChange={setBuildMenuOpen}
          resources={myResources}
          piecesRemaining={{
            road: me?.roadsRemaining ?? 0,
            settlement: me?.settlementsRemaining ?? 0,
            city: me?.citiesRemaining ?? 0,
            developmentCard: 1,
          }}
          deckRemaining={deckRemaining}
          onPreview={setBuildPreview}
          onBuild={handleBuildChoice}
          onTradeFor={openTradeDeskFor}
          canBuild={canBuild}
          disabledReason={
            !isMyTurn ? `Waiting for ${waitingOn}` : !hasRolled ? 'Roll the dice first' : 'You cannot build right now'
          }
        />
      </div>

      <div className="pointer-events-none fixed bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.5rem))] left-[4.25rem] z-[35] max-md:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] max-md:left-[calc(max(0.375rem,env(safe-area-inset-left))+2.75rem)]">
        <WishlistTag
          wants={myWishlist.wants ?? null}
          offers={myWishlist.offers ?? null}
          onChange={setTradeWishlist}
          disabled={!isLive}
        />
      </div>

      <MiniLog entries={miniLog.entries} players={players} />

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
        pulseEndTurn={nothingLeftToDo}
      />

      {/* ---- Bottom: the viewer's own hand, centred over the board ---- */}
      {me && (
        <div className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 max-w-[96vw] -translate-x-1/2 max-md:bottom-[max(0.5rem,env(safe-area-inset-bottom))]">
          <CardHand
            player={me}
            onPlayDevCard={handlePlayCard}
            canPlay={canAct && isMainGame}
            deckRemaining={deckRemaining}
            earmarked={earmarkedCards}
            canTradeAtPort={canBuild}
            onPortTrade={tradeWithBank}
          />
        </div>
      )}

      {/* ---- Cinematic roll: huge dice take the centre of the screen ---- */}
      <DiceCinematic
        cinematic={rollCinematic}
        rolledByName={rollCinematic?.rolledBy != null ? nameOf(rollCinematic.rolledBy) : null}
      />

      {/* ---- A 7: the screen edges close in, dark and red ---- */}
      <SevenVignette pulseKey={sevenPulse} />

      {/* ---- Production in flight: hex centres to the seats that collected ---- */}
      <FlyingResources burst={flightBurst} onDone={() => setFlightBurst(null)} />

      {/* ---- Monopoly: every victim's cards drain into the caller's hand ---- */}
      <MonopolyDrain event={monopoly} myPlayerId={myPlayerId} onDone={clearMonopoly} />

      {/* ---- Emotes: a bubble over the sender's seat chip ---- */}
      <EmoteBubbleLayer emotes={emotes} />
      <EmoteWheel onEmote={sendEmote} disabled={!isLive} />

      <SideDrawer
        log={log}
        chatMessages={chatMessages}
        players={players}
        myPlayerId={myPlayerId}
        onSendChat={sendChat}
        frequencies={game?.diceRollFrequencies}
        blockTrades={blockTrades}
        onToggleBlockTrades={toggleBlockTrades}
        disabled={!isLive}
      />

      {tradeOpenTurn != null && tradeOpenTurn === (game?.turnNumber ?? 0) && isMainGame && isMyTurn && me && (
        <TradeModal
          onClose={() => {
            setTradeOpenTurn(null);
            setTradePrefill(null);
          }}
          player={me}
          opponents={opponents}
          activeOffer={activeOffer}
          lastResult={lastTradeResult}
          onPropose={async (target, give, get) => {
            // Once it is on the table the desk has nothing left to show: the proposer's job
            // is now to watch the answers come in and pick a partner, which is the status
            // panel's business.
            const sent = await proposeTrade(target, give, get);
            if (sent) {
              setTradeOpenTurn(null);
              setTradePrefill(null);
            }
          }}
          onCancel={cancelTrade}
          onBankTrade={tradeWithBank}
          disabled={!canBuild}
          prefillRequest={tradePrefill}
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

      {/* My own offer on the table: who has answered, and who I close the deal with. The
          trade desk is not open at this point, so this is the only place the choice lives. */}
      {isMainGame && myLiveOffer && !(tradeOpenTurn != null && tradeOpenTurn === (game?.turnNumber ?? 0)) && (
        <OfferStatusPanel
          offer={myLiveOffer}
          players={players}
          myPlayerId={myPlayerId}
          negotiators={negotiators}
          onConfirm={confirmTrade}
          onCancel={cancelTrade}
          disabled={!isLive}
        />
      )}

      {isMainGame &&
        activeOffer &&
        iAmOfferRecipient &&
        me &&
        !blockTrades &&
        !(counterOf && counterOf.offerId === activeOffer.offerId) && (
          <TradeOfferPanel
            offer={activeOffer}
            sender={offerSender}
            recipient={me}
            onAccept={acceptTrade}
            onReject={rejectTrade}
            onCounter={() => setCounterOf(activeOffer)}
            disabled={!isLive}
          />
        )}

      {/* The hand of face-down cards. Its own timers close it, so the render condition
          deliberately does not depend on the robber phase - which the server has already
          ended by the time the stolen card is revealed. */}
      {pendingSteal && (
        <BlindStealOverlay
          victim={stealVictim}
          stolenResource={revealedSteal}
          onPick={async () => {
            const moved = await moveRobber(pendingSteal.hexId, pendingSteal.victimId);
            // Rejected (a stale click, say): drop the overlay and let the error banner talk.
            if (!moved) setPendingSteal(null);
          }}
          onCancel={() => setPendingSteal(null)}
          onDone={() => setPendingSteal(null)}
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
          turnNumber={game?.turnNumber}
          isHost={room.hostPlayerId === myPlayerId}
          onPlayAgain={restartGame}
          onNewGame={leaveRoom}
          disabled={!isLive}
        />
      )}
    </main>
  );
}
