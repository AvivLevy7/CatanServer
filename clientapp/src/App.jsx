import { useState } from 'react';
import Board from './components/Board';
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
  const { board, status, error, resetBoard } = useGameHub();
  const [selected, setSelected] = useState(null);

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

  const handleReshuffle = () => {
    resetBoard();
    setSelected(null);
  };

  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-sky-900 p-6">
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
              status === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          {STATUS_LABELS[status] ?? status}
        </p>
      </header>

      <Board tiles={tiles} selectedId={selected?.id} onTileSelect={setSelected} />

      <button
        type="button"
        onClick={handleReshuffle}
        className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
      >
        Reshuffle board (all players)
      </button>
    </main>
  );
}
