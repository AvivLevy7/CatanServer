const PLAYER_TEXT = {
  Red: 'text-red-300',
  Blue: 'text-blue-300',
  Orange: 'text-orange-300',
  White: 'text-stone-100',
};

const ORDINAL = { SetupRound1: '1st', SetupRound2: '2nd' };

/**
 * Prominent banner describing the current phase and what the active player must do.
 */
export default function PhaseBanner({ game, currentPlayer, robberMover, isMyTurn = true }) {
  if (!game || !currentPlayer) return null;

  const isSetup = game.phase === 'SetupRound1' || game.phase === 'SetupRound2';
  const isRobber = game.phase === 'WaitingForDiscards' || game.phase === 'MovingRobber';
  const actor = isRobber && robberMover ? robberMover : currentPlayer;
  const colorClass = PLAYER_TEXT[actor.color] ?? 'text-amber-50';

  let title;
  let instruction;

  if (isSetup) {
    title = `Setup Phase - Round ${game.phase === 'SetupRound1' ? 1 : 2}`;
    instruction =
      game.setupStep === 'PlaceRoad'
        ? 'place a road touching your new settlement'
        : `place your ${ORDINAL[game.phase]} settlement`;
  } else if (game.phase === 'WaitingForDiscards') {
    title = 'Robber! Discarding';
    const owing = Object.keys(game.pendingDiscards ?? {}).length;
    instruction = `wait while ${owing} player${owing === 1 ? '' : 's'} discard${owing === 1 ? 's' : ''} half their hand`;
  } else if (game.phase === 'MovingRobber') {
    title = 'Robber! Move it';
    instruction = 'click a tile to move the robber and steal a card';
  } else if (game.phase === 'PlacingFreeRoads') {
    title = 'Road Building';
    const n = game.freeRoadsRemaining ?? 0;
    instruction = `place ${n} free road${n === 1 ? '' : 's'}`;
  } else if (game.phase === 'GameOver') {
    title = 'Game Over';
    instruction = 'the game has ended';
  } else {
    title = game.allowSevens === false ? 'Main Game - No 7s' : 'Main Game';
    instruction = game.hasRolledDice ? 'build, trade, or end your turn' : 'roll the dice (or play a card first)';
  }

  const highlight = isSetup || isRobber || game.phase === 'PlacingFreeRoads';

  return (
    <section
      aria-live="polite"
      className={`rounded-xl px-4 py-3 text-center shadow ${
        highlight ? 'bg-amber-200/90 text-stone-900' : 'bg-sky-800/70 text-amber-50'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-0.5 text-base font-medium">
        <span className={highlight ? 'font-bold' : `font-bold ${colorClass}`}>
          {isMyTurn ? 'You' : `${actor.name} (${actor.color})`}
        </span>
        {isMyTurn ? `, ${instruction}.` : `: waiting for them to ${instruction}.`}
      </p>
    </section>
  );
}
