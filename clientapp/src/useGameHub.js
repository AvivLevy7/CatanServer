import { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';

// Relative path: the Vite dev proxy forwards /hubs (with ws: true) to the C# server,
// so there is no hard-coded port here and no CORS preflight in development.
// To bypass the proxy, set VITE_HUB_URL to e.g. https://localhost:7048/hubs/game
const HUB_URL = import.meta.env.VITE_HUB_URL ?? '/hubs/game';

// Server-to-client method defined by IGameClient on the C# side.
const BOARD_STATE_EVENT = 'BoardState';

/**
 * Owns the SignalR connection and exposes the server-authoritative board.
 * The hub pushes BoardState inside OnConnectedAsync, so no initial fetch is required.
 */
export function useGameHub() {
  const [board, setBoard] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
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

    connection.onreconnecting(() => {
      if (!cancelled) setStatus('reconnecting');
    });

    connection.onreconnected(async () => {
      if (cancelled) return;
      setStatus('connected');
      // Re-sync: the board may have changed while we were away.
      try {
        const latest = await connection.invoke('GetBoardState');
        if (!cancelled) setBoard(latest);
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
      connection.stop();
      connectionRef.current = null;
    };
  }, []);

  const resetBoard = useCallback(() => {
    const connection = connectionRef.current;
    if (connection?.state === HubConnectionState.Connected) {
      connection.invoke('ResetBoard').catch(() => {});
    }
  }, []);

  return { board, status, error, resetBoard };
}
