import { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { sound } from './audio';
import { haptics } from './haptics';
import {
  HEARTBEAT_MS,
  beatHeartbeat,
  clearSession,
  restoreIntent,
  saveSession,
} from './session';

// Base URL of the C# server, e.g. https://catan-api.onrender.com (no trailing slash).
// Empty in development: the Vite dev proxy forwards /hubs (with ws: true) to the server,
// so there is no hard-coded port and no CORS preflight locally.
// Set in .env.production (or the hosting platform's build env) for deployments.
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const HUB_URL = `${API_URL}/hubs/game`;

// Server-to-client methods defined by IGameClient on the C# side.
const ROOM_STATE_EVENT = 'RoomState';
const BOARD_STATE_EVENT = 'BoardState';
const GAME_STATE_EVENT = 'GameState';
const DICE_ROLLED_EVENT = 'DiceRolled';
const ROBBER_MOVED_EVENT = 'RobberMoved';
const GAME_OVER_EVENT = 'GameOver';
// Cinematic dice roll: the pair tumbles, snaps to the real faces, then holds the result
// before the HUD comes back. The resource payout is withheld for the whole window.
export const DICE_TUMBLE_MS = 1150;
export const DICE_REVEAL_MS = 650;
export const DICE_ANIMATION_MS = DICE_TUMBLE_MS + DICE_REVEAL_MS;
const TRADE_OFFERED_EVENT = 'TradeOffered';
const TRADE_RESOLVED_EVENT = 'TradeResolved';
const MONOPOLY_EVENT = 'MonopolyPlayed';

// How long an emote bubble stays up, and the longest a negotiation icon may linger
// before it clears itself in case the matching "done" event never arrives.
const EMOTE_VISIBLE_MS = 3000;
const NEGOTIATION_MAX_MS = 45000;

/** The seat stored for this browser, or null. Read fresh: a reconnect may be minutes later. */
function readStoredSession() {
  return restoreIntent().session;
}

/** Copy of `map` without `key`; returns `map` itself when the key was not there. */
function without(map, key) {
  if (!(key in map)) return map;
  const next = { ...map };
  delete next[key];
  return next;
}

/**
 * Owns the SignalR connection and exposes the server-authoritative board and game state.
 * The hub pushes BoardState and GameState inside OnConnectedAsync, so no initial fetch is required.
 */
export function useGameHub() {
  const [room, setRoom] = useState(null);
  // { roomId, playerId, token } for this seat. Set once the server has accepted the claim,
  // never straight from storage: a stored seat is only ours if the hub says so.
  const [session, setSession] = useState(null);
  // What the stored seat (if any) should do on this page load - see session.js. Decided
  // once, on mount: a later re-render must not change its mind about whose seat this is.
  const [restoreOnLoad] = useState(restoreIntent);
  // A seat another tab of this browser is currently playing. Offered as a choice on the
  // landing page rather than taken, so opening a second tab cannot kick the first.
  const [resumable, setResumable] = useState(() =>
    restoreOnLoad.kind === 'offer' ? restoreOnLoad.session : null,
  );
  const [board, setBoard] = useState(null);
  const [game, setGame] = useState(null);
  const [lastRoll, setLastRoll] = useState(null);
  // The last robbery: the server's RobberMoved plus a monotonic `id`. The id is what lets
  // screens replay the theft - two steals of the same card off the same tile are otherwise
  // indistinguishable, and the second would be swallowed as "nothing changed".
  const [lastRobbery, setLastRobbery] = useState(null);
  const robberySeq = useRef(0);
  const [winner, setWinner] = useState(null);
  // Bumps every time the host restarts so screens can reset local UI (e.g. the log).
  const [restartCount, setRestartCount] = useState(0);
  // Latest server announcement (timeouts etc.); App appends it to the log.
  const [systemMessage, setSystemMessage] = useState(null);
  // Room chat history for this page load.
  const [chatMessages, setChatMessages] = useState([]);
  // Emotes still on screen, as playerId -> { id, emote, senderName }. Self-expiring.
  const [emotes, setEmotes] = useState({});
  // Who is weighing the live trade offer, as playerId -> 'Inspecting' | 'Countering'.
  const [negotiators, setNegotiators] = useState({});
  // Standing wants/offers, as playerId -> { wants, offers }. Room state, not ephemeral:
  // the hub replays them on connect, so a refresh does not lose them.
  const [wishlists, setWishlists] = useState({});
  // Bumps on every 7 so the screen can replay its vignette; 0 means "no 7 yet".
  const [sevenPulse, setSevenPulse] = useState(0);
  // The Monopoly just played: { id, playerId, playerName, resource, collected, takes }.
  // The id is monotonic so a second Monopoly cannot be swallowed by the first's cleanup.
  const [monopoly, setMonopoly] = useState(null);
  const monopolySeq = useRef(0);
  const emoteTimers = useRef(new Map());
  const negotiationTimers = useRef(new Map());
  const [isRolling, setIsRolling] = useState(false);
  // Drives the full-screen dice overlay: { phase: 'tumbling' | 'reveal', roll, rolledBy }.
  const [rollCinematic, setRollCinematic] = useState(null);
  const rollRevealRef = useRef(null);
  const rollLandRef = useRef(null);
  // While the dice tumble, GameState updates are parked here and applied on reveal so
  // nobody sees their resources change before the result is shown.
  const rollingRef = useRef(false);
  const deferredGameRef = useRef(null);
  // Most recent accept/decline/cancel so the proposer gets feedback.
  const [lastTradeResult, setLastTradeResult] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const connectionRef = useRef(null);

  /**
   * Hands the stored token to the hub to take (or retake) the seat it belongs to. A refusal
   * means the claim is dead - the room has gone, or the seat is not ours - so the stored
   * session is dropped and the player lands back on the front page rather than staring at a
   * screen that will never fill in.
   */
  const claim = useCallback(async (connection, saved, { quiet = false } = {}) => {
    if (!saved?.roomId || !saved?.playerId || !saved?.token) return false;

    try {
      const joined = await connection.invoke('RejoinRoom', saved.roomId, saved.playerId, saved.token);
      const next = { roomId: joined.roomId, playerId: joined.playerId, token: joined.sessionToken };
      saveSession(next);
      setSession(next);
      setRoom(joined.room);
      setResumable(null);
      return true;
    } catch (err) {
      clearSession();
      setSession(null);
      setRoom(null);
      setResumable(null);
      if (!quiet) {
        setActionError(err?.message?.replace(/^.*HubException: /, '') ?? 'That game is no longer available.');
      }
      return false;
    }
  }, []);

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    // Captured once so the cleanup below does not read .current after unmount; both are
    // stable containers, so clearing them here clears the live timers.
    const pendingEmoteTimers = emoteTimers.current;
    const pendingNegotiationTimers = negotiationTimers.current;

    // Guards against setting state after unmount, which React 19 StrictMode
    // would otherwise trigger via its double-invoked effects.
    let cancelled = false;

    connection.on(ROOM_STATE_EVENT, (nextRoom) => {
      if (!cancelled) {
        setRoom(nextRoom);
      }
    });

    connection.on(BOARD_STATE_EVENT, (nextBoard) => {
      if (!cancelled) {
        setBoard(nextBoard);
      }
    });

    connection.on(GAME_STATE_EVENT, (nextGame) => {
      if (cancelled) return;
      if (rollingRef.current) {
        deferredGameRef.current = nextGame;
        return;
      }
      setGame(nextGame);
    });

    connection.on(DICE_ROLLED_EVENT, (event) => {
      if (cancelled) return;
      // Two beats: tumble blind, then snap to the real faces and hold. App locks the
      // controls while isRolling, and the post-roll GameState (with the resource payout)
      // is parked until the whole cinematic has played out.
      clearTimeout(rollRevealRef.current);
      clearTimeout(rollLandRef.current);
      sound.play('dice');
      rollingRef.current = true;
      setIsRolling(true);
      setRollCinematic({ phase: 'tumbling', roll: event?.roll ?? null, rolledBy: event?.rolledBy ?? null });

      rollLandRef.current = setTimeout(() => {
        if (cancelled) return;
        setRollCinematic({ phase: 'reveal', roll: event?.roll ?? null, rolledBy: event?.rolledBy ?? null });
        // The dread lands with the number, not after it: the vignette and its cue start
        // the moment the total is readable.
        if (event?.roll?.total === 7) {
          sound.play('seven');
          haptics.play('seven');
          setSevenPulse((n) => n + 1);
        }
      }, DICE_TUMBLE_MS);

      rollRevealRef.current = setTimeout(() => {
        if (cancelled) return;
        rollingRef.current = false;
        setRollCinematic(null);
        setLastRoll(event);
        setIsRolling(false);
        if (deferredGameRef.current) {
          setGame(deferredGameRef.current);
          deferredGameRef.current = null;
        }
      }, DICE_ANIMATION_MS);
    });

    connection.on(ROBBER_MOVED_EVENT, (robbery) => {
      if (!cancelled) {
        setLastRobbery({ ...robbery, id: ++robberySeq.current });
      }
    });

    connection.on(GAME_OVER_EVENT, (winningPlayer) => {
      if (!cancelled) {
        setWinner(winningPlayer);
      }
    });

    connection.on('SystemMessage', (message) => {
      if (!cancelled) {
        setSystemMessage(message);
      }
    });

    connection.on('ChatMessage', (message) => {
      if (!cancelled) {
        setChatMessages((prev) => [...prev.slice(-199), message]);
      }
    });

    connection.on('Emote', (emote) => {
      if (cancelled || emote?.senderId == null) return;
      sound.play('emote');
      const { senderId } = emote;
      setEmotes((prev) => ({
        ...prev,
        [senderId]: { id: emote.id, emote: emote.emote, senderName: emote.senderName },
      }));

      // Three seconds on screen. A fresh emote from the same seat replaces the old one,
      // so its timer is cleared rather than left to expire the newer bubble.
      clearTimeout(emoteTimers.current.get(senderId));
      emoteTimers.current.set(
        senderId,
        setTimeout(() => {
          emoteTimers.current.delete(senderId);
          setEmotes((prev) => without(prev, senderId));
        }, EMOTE_VISIBLE_MS),
      );
    });

    connection.on('TradeWishlist', (entry) => {
      if (cancelled || entry?.playerId == null) return;
      const { playerId, wants, offers } = entry;
      setWishlists((prev) =>
        wants == null && offers == null
          ? without(prev, playerId)
          : { ...prev, [playerId]: { wants, offers } },
      );
    });

    connection.on('NegotiationStatus', (status) => {
      if (cancelled || status?.playerId == null) return;
      const { playerId, activity } = status;
      clearTimeout(negotiationTimers.current.get(playerId));
      negotiationTimers.current.delete(playerId);

      if (!activity || activity === 'None') {
        setNegotiators((prev) => without(prev, playerId));
        return;
      }

      setNegotiators((prev) => ({ ...prev, [playerId]: activity }));
      // Safety net: if the "done" event is lost (a tab closing mid-deliberation, say)
      // the icon still clears itself instead of spinning forever.
      negotiationTimers.current.set(
        playerId,
        setTimeout(() => {
          negotiationTimers.current.delete(playerId);
          setNegotiators((prev) => without(prev, playerId));
        }, NEGOTIATION_MAX_MS),
      );
    });

    connection.on('GameRestarted', () => {
      if (!cancelled) {
        setWinner(null);
        setEmotes({});
        setNegotiators({});
        setWishlists({});
        setSevenPulse(0);
        setLastRoll(null);
        setRollCinematic(null);
        setLastRobbery(null);
        setLastTradeResult(null);
        setRestartCount((n) => n + 1);
      }
    });

    connection.on(TRADE_OFFERED_EVENT, () => {
      if (!cancelled) {
        setLastTradeResult(null);
      }
    });

    connection.on(TRADE_RESOLVED_EVENT, (result) => {
      if (!cancelled) {
        // A deal actually closing is worth a buzz; a decline is not.
        if (result?.outcome === 'Confirmed') haptics.play('click');
        setLastTradeResult(result);
      }
    });

    connection.on(MONOPOLY_EVENT, (event) => {
      if (cancelled || event?.playerId == null) return;
      sound.play('steal');
      haptics.play('seven');
      setMonopoly({ ...event, id: ++monopolySeq.current });
    });

    connection.onreconnecting(() => {
      if (!cancelled) setStatus('reconnecting');
    });

    connection.onreconnected(async () => {
      if (cancelled) return;
      setStatus('connected');
      // A new connection id means the seat must be claimed again before the hub will
      // talk to us: same token, same seat, same hand.
      await claim(connection, readStoredSession(), { quiet: true });
    });

    connection.onclose(() => {
      if (!cancelled) setStatus('disconnected');
    });

    connection
      .start()
      .then(async () => {
        if (cancelled) return;
        setStatus('connected');
        // Reclaim the seat this browser was last sitting in - unless another tab is
        // playing it, in which case it stays on offer instead.
        if (restoreOnLoad.kind === 'resume') {
          await claim(connection, restoreOnLoad.session);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error');
          setError(err?.message ?? 'Unable to reach the server');
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(rollRevealRef.current);
      clearTimeout(rollLandRef.current);
      connection.off(ROOM_STATE_EVENT);
      connection.off(BOARD_STATE_EVENT);
      connection.off(GAME_STATE_EVENT);
      connection.off(DICE_ROLLED_EVENT);
      connection.off(ROBBER_MOVED_EVENT);
      connection.off(GAME_OVER_EVENT);
      connection.off(TRADE_OFFERED_EVENT);
      connection.off(TRADE_RESOLVED_EVENT);
      connection.off(MONOPOLY_EVENT);
      connection.off('ChatMessage');
      connection.off('SystemMessage');
      connection.off('Emote');
      connection.off('NegotiationStatus');
      connection.off('TradeWishlist');
      for (const timer of pendingEmoteTimers.values()) clearTimeout(timer);
      pendingEmoteTimers.clear();
      for (const timer of pendingNegotiationTimers.values()) clearTimeout(timer);
      pendingNegotiationTimers.clear();
      connection.stop();
      connectionRef.current = null;
    };
    // `claim` is stable (useCallback with no dependencies); the socket is built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Takes the seat another tab was holding (the landing page's "rejoin" button). */
  const resumeSession = useCallback(async () => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return false;
    return claim(connection, resumable ?? readStoredSession());
  }, [claim, resumable]);

  const dismissResumable = useCallback(() => {
    clearSession();
    setResumable(null);
  }, []);

  // While this tab holds a seat it says so, so a second tab knows not to take it.
  useEffect(() => {
    if (!session || status !== 'connected') return undefined;
    beatHeartbeat();
    const id = setInterval(beatHeartbeat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [session, status]);

  const resetBoard = useCallback(() => {
    const connection = connectionRef.current;
    if (connection?.state === HubConnectionState.Connected) {
      setLastRoll(null);
      connection.invoke('ResetBoard').catch(() => {});
    }
  }, []);

  const rollDice = useCallback(() => {
    const connection = connectionRef.current;
    if (connection?.state === HubConnectionState.Connected) {
      connection.invoke('ClientRollDice').catch(() => {});
    }
  }, []);

  const endTurn = useCallback(() => {
    const connection = connectionRef.current;
    if (connection?.state === HubConnectionState.Connected) {
      connection.invoke('EndTurn').catch(() => {});
    }
  }, []);

  // Rule-checked moves: the hub rejects illegal ones with a HubException whose
  // message is safe to show. Returns true when the move was accepted.
  const invokeMove = useCallback(async (method, ...args) => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return false;
    setActionError(null);
    try {
      await connection.invoke(method, ...args);
      return true;
    } catch (err) {
      setActionError(err?.message?.replace(/^.*HubException: /, '') ?? 'Illegal move');
      return false;
    }
  }, []);

  // Placements get their own cue, played only once the server has accepted the move so a
  // rejected click stays silent.
  const invokeBuild = useCallback(
    async (method, cue, ...args) => {
      const placed = await invokeMove(method, ...args);
      if (placed) {
        sound.play(cue);
        haptics.play('click');
      }
      return placed;
    },
    [invokeMove],
  );

  const buildSettlement = useCallback(
    (nodeId) => invokeBuild('BuildSettlement', 'settlement', nodeId),
    [invokeBuild],
  );
  const buildRoad = useCallback((edgeId) => invokeBuild('BuildRoad', 'road', edgeId), [invokeBuild]);
  const buildCity = useCallback((nodeId) => invokeBuild('BuildCity', 'city', nodeId), [invokeBuild]);
  const tradeWithBank = useCallback(
    (give, receive) => invokeMove('TradeWithBank', give, receive),
    [invokeMove],
  );
  const proposeTrade = useCallback(
    (targetPlayerId, offered, requested) =>
      invokeMove('ProposeTrade', targetPlayerId ?? null, offered, requested),
    [invokeMove],
  );
  // Accepting only registers willingness; the proposer then picks who they deal with.
  const acceptTrade = useCallback((offerId) => invokeMove('AcceptTrade', offerId), [invokeMove]);
  const confirmTrade = useCallback(
    (offerId, partnerPlayerId) => invokeMove('ConfirmTrade', offerId, partnerPlayerId),
    [invokeMove],
  );
  const rejectTrade = useCallback((offerId) => invokeMove('RejectTrade', offerId), [invokeMove]);
  const cancelTrade = useCallback((offerId) => invokeMove('CancelTrade', offerId), [invokeMove]);
  const discardCards = useCallback(
    (cards) => invokeMove('DiscardCards', cards),
    [invokeMove],
  );
  const moveRobber = useCallback(
    (hexId, targetPlayerId) => invokeMove('MoveRobber', hexId, targetPlayerId ?? null),
    [invokeMove],
  );
  const buyDevelopmentCard = useCallback(() => invokeMove('BuyDevelopmentCard'), [invokeMove]);
  const playKnightCard = useCallback((cardId) => invokeMove('PlayKnightCard', cardId), [invokeMove]);
  const playMonopoly = useCallback(
    (cardId, resource) => invokeMove('PlayMonopoly', cardId, resource),
    [invokeMove],
  );
  const playYearOfPlenty = useCallback(
    (cardId, res1, res2) => invokeMove('PlayYearOfPlenty', cardId, res1, res2),
    [invokeMove],
  );
  const playRoadBuilding = useCallback(
    (cardId) => invokeMove('PlayRoadBuilding', cardId),
    [invokeMove],
  );
  // Read-only query; returns [] on failure so the caller can fall back gracefully.
  const getStealCandidates = useCallback(async (hexId) => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return [];
    try {
      return await connection.invoke('GetStealCandidates', hexId);
    } catch {
      return [];
    }
  }, []);
  const placeInitialSettlement = useCallback(
    (nodeId) => invokeBuild('PlaceInitialSettlement', 'settlement', nodeId),
    [invokeBuild],
  );
  const placeInitialRoad = useCallback(
    (edgeId) => invokeBuild('PlaceInitialRoad', 'road', edgeId),
    [invokeBuild],
  );
  // Take the last road/settlement back. The server owns the window, so a late click is
  // simply refused rather than silently doing nothing.
  const undoBuild = useCallback(() => invokeMove('UndoBuild'), [invokeMove]);

  // Lobby. Create/Join return { roomId, playerId, sessionToken, room }; the seat and its
  // token are remembered so a refresh or a dropped socket can claim it back.
  const enterRoom = useCallback(async (method, ...args) => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return null;
    setActionError(null);
    try {
      const joined = await connection.invoke(method, ...args);
      const next = { roomId: joined.roomId, playerId: joined.playerId, token: joined.sessionToken };
      saveSession(next);
      setSession(next);
      setRoom(joined.room);
      setResumable(null);
      return next;
    } catch (err) {
      setActionError(err?.message?.replace(/^.*HubException: /, '') ?? 'Could not join');
      return null;
    }
  }, []);
  /**
   * Opens a room and, if the player asked for company on the landing page, seats that many
   * bots straight away. The room id comes from the join result rather than from state,
   * which has not been committed yet at this point.
   */
  const createRoom = useCallback(
    async (name, bots = 0) => {
      const joined = await enterRoom('CreateRoom', name);
      if (!joined) return false;

      for (let i = 0; i < bots; i++) {
        // Sequential on purpose: each bot takes the next free seat and colour.
        const seated = await invokeMove('AddBot', joined.roomId);
        if (!seated) break;
      }

      return true;
    },
    [enterRoom, invokeMove],
  );
  const joinRoom = useCallback(
    async (roomId, name) => (await enterRoom('JoinRoom', roomId, name)) !== null,
    [enterRoom],
  );
  const leaveRoom = useCallback(() => {
    clearSession();
    setSession(null);
    setRoom(null);
    setBoard(null);
    setGame(null);
    setLastRoll(null);
    setWinner(null);
    // Simplest way to drop the SignalR group: reconnect.
    window.location.reload();
  }, []);
  const startGame = useCallback(
    (allowSevens = true) => {
      setLastRoll(null);
      setWinner(null);
      return invokeMove('StartGame', session?.roomId, allowSevens);
    },
    [invokeMove, session?.roomId],
  );
  const restartGame = useCallback(
    () => invokeMove('RestartGame', session?.roomId),
    [invokeMove, session?.roomId],
  );
  const addBot = useCallback(() => invokeMove('AddBot', session?.roomId), [invokeMove, session?.roomId]);
  const removeBot = useCallback(
    (botId) => invokeMove('RemoveBot', session?.roomId, botId),
    [invokeMove, session?.roomId],
  );
  const sendChat = useCallback((text) => invokeMove('SendChat', text), [invokeMove]);
  // Cosmetic, so a rejected emote is swallowed rather than shown as an illegal move.
  const sendEmote = useCallback((emote) => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return;
    connection.invoke('SendEmote', emote).catch(() => {});
  }, []);
  // A standing notice rather than a move, so a failure is not worth an error banner.
  const setTradeWishlist = useCallback((wants, offers) => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return;
    connection.invoke('SetTradeWishlist', wants ?? null, offers ?? null).catch(() => {});
  }, []);
  // Advisory too: never worth an error banner if it does not reach the table.
  const setNegotiationStatus = useCallback((activity) => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return;
    connection.invoke('SetNegotiationStatus', activity).catch(() => {});
  }, []);

  return {
    room,
    session,
    myPlayerId: session?.playerId ?? null,
    // A seat left behind in this browser that another tab is using; null when there is none.
    resumable,
    resumeSession,
    dismissResumable,
    createRoom,
    joinRoom,
    leaveRoom,
    addBot,
    removeBot,
    chatMessages,
    sendChat,
    emotes,
    sendEmote,
    negotiators,
    setNegotiationStatus,
    sevenPulse,
    board,
    game,
    lastRoll,
    status,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    resetBoard,
    rollDice,
    endTurn,
    buildSettlement,
    buildRoad,
    buildCity,
    tradeWithBank,
    proposeTrade,
    acceptTrade,
    confirmTrade,
    rejectTrade,
    cancelTrade,
    wishlists,
    setTradeWishlist,
    lastTradeResult,
    clearTradeResult: () => setLastTradeResult(null),
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
    lastRobbery,
    placeInitialSettlement,
    placeInitialRoad,
    undoBuild,
    monopoly,
    clearMonopoly: () => setMonopoly(null),
    startGame,
  };
}
