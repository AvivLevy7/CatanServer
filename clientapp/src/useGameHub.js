import { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';

// Relative path: the Vite dev proxy forwards /hubs (with ws: true) to the C# server,
// so there is no hard-coded port here and no CORS preflight in development.
// To bypass the proxy, set VITE_HUB_URL to e.g. https://localhost:7048/hubs/game
const HUB_URL = import.meta.env.VITE_HUB_URL ?? '/hubs/game';

// Server-to-client methods defined by IGameClient on the C# side.
const BOARD_STATE_EVENT = 'BoardState';
const GAME_STATE_EVENT = 'GameState';
const DICE_ROLLED_EVENT = 'DiceRolled';
const ROBBER_MOVED_EVENT = 'RobberMoved';

/**
 * Owns the SignalR connection and exposes the server-authoritative board and game state.
 * The hub pushes BoardState and GameState inside OnConnectedAsync, so no initial fetch is required.
 */
export function useGameHub() {
  const [board, setBoard] = useState(null);
  const [game, setGame] = useState(null);
  const [lastRoll, setLastRoll] = useState(null);
  const [lastRobbery, setLastRobbery] = useState(null);
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
      if (!cancelled) {
        setLastRoll(roll);
      }
    });

    connection.on(ROBBER_MOVED_EVENT, (robbery) => {
      if (!cancelled) {
        setLastRobbery(robbery);
      }
    });

    connection.onreconnecting(() => {
      if (!cancelled) setStatus('reconnecting');
    });

    connection.onreconnected(async () => {
      if (cancelled) return;
      setStatus('connected');
      // Re-sync: the board may have changed while we were away.
      try {
        const [latestBoard, latestGame] = await Promise.all([
          connection.invoke('GetBoardState'),
          connection.invoke('GetGameState'),
        ]);
        if (!cancelled) {
          setBoard(latestBoard);
          setGame(latestGame);
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
      .then(() => {
        if (!cancelled) setStatus('connected');
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error');
          setError(err?.message ?? 'Unable to reach the server');
        }
      });

    return () => {
      cancelled = true;
      connection.off(BOARD_STATE_EVENT);
      connection.off(GAME_STATE_EVENT);
      connection.off(DICE_ROLLED_EVENT);
      connection.off(ROBBER_MOVED_EVENT);
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
  const discardCards = useCallback(
    (playerId, cards) => invokeMove('DiscardCards', playerId, cards),
    [invokeMove],
  );
  const moveRobber = useCallback(
    (hexId, targetPlayerId) => invokeMove('MoveRobber', hexId, targetPlayerId ?? null),
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
  const startGame = useCallback(
    (playerCount) => {
      setLastRoll(null);
      return invokeMove('StartGame', playerCount);
    },
    [invokeMove],
  );

  return {
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
    discardCards,
    moveRobber,
    getStealCandidates,
    lastRobbery,
    placeInitialSettlement,
    placeInitialRoad,
    startGame,
  };
}
