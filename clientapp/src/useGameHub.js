import { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { sound } from './audio';

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
export const DICE_ANIMATION_MS = 1500;
const TRADE_OFFERED_EVENT = 'TradeOffered';
const TRADE_RESOLVED_EVENT = 'TradeResolved';

/**
 * Owns the SignalR connection and exposes the server-authoritative board and game state.
 * The hub pushes BoardState and GameState inside OnConnectedAsync, so no initial fetch is required.
 */
export function useGameHub() {
  const [room, setRoom] = useState(null);
  // { roomId, playerId } for this browser; persisted so a refresh can rejoin.
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('catan.session')) ?? null;
    } catch {
      return null;
    }
  });
  const [board, setBoard] = useState(null);
  const [game, setGame] = useState(null);
  const [lastRoll, setLastRoll] = useState(null);
  const [lastRobbery, setLastRobbery] = useState(null);
  const [winner, setWinner] = useState(null);
  // Bumps every time the host restarts so screens can reset local UI (e.g. the log).
  const [restartCount, setRestartCount] = useState(0);
  // Latest server announcement (timeouts etc.); App appends it to the log.
  const [systemMessage, setSystemMessage] = useState(null);
  // Room chat history for this page load.
  const [chatMessages, setChatMessages] = useState([]);
  const [isRolling, setIsRolling] = useState(false);
  const rollRevealRef = useRef(null);
  // Most recent accept/decline/cancel so the proposer gets feedback.
  const [lastTradeResult, setLastTradeResult] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const connectionRef = useRef(null);

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connectionRef.current = connection;

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
      if (!cancelled) {
        setGame(nextGame);
      }
    });

    connection.on(DICE_ROLLED_EVENT, (roll) => {
      if (cancelled) return;
      // Tumble for a moment before revealing; App locks the controls while isRolling.
      clearTimeout(rollRevealRef.current);
      sound.play('dice');
      setIsRolling(true);
      rollRevealRef.current = setTimeout(() => {
        if (cancelled) return;
        setLastRoll(roll);
        setIsRolling(false);
      }, DICE_ANIMATION_MS);
    });

    connection.on(ROBBER_MOVED_EVENT, (robbery) => {
      if (!cancelled) {
        setLastRobbery(robbery);
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

    connection.on('GameRestarted', () => {
      if (!cancelled) {
        setWinner(null);
        setLastRoll(null);
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
        setLastTradeResult(result);
      }
    });

    connection.onreconnecting(() => {
      if (!cancelled) setStatus('reconnecting');
    });

    connection.onreconnected(async () => {
      if (cancelled) return;
      setStatus('connected');
      // Re-sync: a new connection id means we must re-enter the room group.
      try {
        const saved = JSON.parse(sessionStorage.getItem('catan.session'));
        if (saved?.roomId && saved?.playerId) {
          await connection.invoke('RejoinRoom', saved.roomId, saved.playerId);
        }
      } catch {
        /* the next push will correct us */
      }
    });

    connection.onclose(() => {
      if (!cancelled) setStatus('disconnected');
    });

    connection
      .start()
      .then(async () => {
        if (cancelled) return;
        setStatus('connected');
        // Resume a room from a previous page load, if any.
        try {
          const saved = JSON.parse(sessionStorage.getItem('catan.session'));
          if (saved?.roomId && saved?.playerId) {
            await connection.invoke('RejoinRoom', saved.roomId, saved.playerId);
          }
        } catch {
          sessionStorage.removeItem('catan.session');
          if (!cancelled) setSession(null);
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
      connection.off(ROOM_STATE_EVENT);
      connection.off(BOARD_STATE_EVENT);
      connection.off(GAME_STATE_EVENT);
      connection.off(DICE_ROLLED_EVENT);
      connection.off(ROBBER_MOVED_EVENT);
      connection.off(GAME_OVER_EVENT);
      connection.off(TRADE_OFFERED_EVENT);
      connection.off(TRADE_RESOLVED_EVENT);
      connection.off('ChatMessage');
      connection.off('SystemMessage');
      connection.stop();
      connectionRef.current = null;
    };
  }, []);

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

  const buildSettlement = useCallback((nodeId) => invokeMove('BuildSettlement', nodeId), [invokeMove]);
  const buildRoad = useCallback((edgeId) => invokeMove('BuildRoad', edgeId), [invokeMove]);
  const buildCity = useCallback((nodeId) => invokeMove('BuildCity', nodeId), [invokeMove]);
  const tradeWithBank = useCallback(
    (give, receive) => invokeMove('TradeWithBank', give, receive),
    [invokeMove],
  );
  const proposeTrade = useCallback(
    (targetPlayerId, offered, requested) =>
      invokeMove('ProposeTrade', targetPlayerId ?? null, offered, requested),
    [invokeMove],
  );
  const acceptTrade = useCallback((offerId) => invokeMove('AcceptTrade', offerId), [invokeMove]);
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
    (nodeId) => invokeMove('PlaceInitialSettlement', nodeId),
    [invokeMove],
  );
  const placeInitialRoad = useCallback((edgeId) => invokeMove('PlaceInitialRoad', edgeId), [invokeMove]);

  // Lobby. Create/Join return { roomId, playerId, room }; we remember our seat.
  const enterRoom = useCallback(async (method, ...args) => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return false;
    setActionError(null);
    try {
      const joined = await connection.invoke(method, ...args);
      const next = { roomId: joined.roomId, playerId: joined.playerId };
      sessionStorage.setItem('catan.session', JSON.stringify(next));
      setSession(next);
      setRoom(joined.room);
      return true;
    } catch (err) {
      setActionError(err?.message?.replace(/^.*HubException: /, '') ?? 'Could not join');
      return false;
    }
  }, []);
  const createRoom = useCallback((name) => enterRoom('CreateRoom', name), [enterRoom]);
  const joinRoom = useCallback((roomId, name) => enterRoom('JoinRoom', roomId, name), [enterRoom]);
  const leaveRoom = useCallback(() => {
    sessionStorage.removeItem('catan.session');
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

  return {
    room,
    session,
    myPlayerId: session?.playerId ?? null,
    createRoom,
    joinRoom,
    leaveRoom,
    addBot,
    removeBot,
    chatMessages,
    sendChat,
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
    rejectTrade,
    cancelTrade,
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
    lastRobbery,
    placeInitialSettlement,
    placeInitialRoad,
    startGame,
  };
}
