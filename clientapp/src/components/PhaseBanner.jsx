import { seat } from '../theme';

const ORDINAL = { SetupRound1: '1st', SetupRound2: '2nd' };

/**
 * Prominent banner describing the current phase and what the active player must do.
 */
export default function PhaseBanner({ game, currentPlayer, robberMover, isMyTurn = true }) {
  if (!game || !currentPlayer) return null;

  const isSetup = game.phase === 'SetupRound1' || game.phase === 'SetupRound2';
  const isRobber = game.phase === 'WaitingForDiscards' || game.phase === 'MovingRobber';
  const actor = isRobber && robberMover ? robberMover : currentPlayer;
  const colorClass = seat(actor.color).text;

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
      className={`pointer-events-none flex max-w-[min(90vw,34rem)] items-center gap-2 rounded-full border px-3.5 py-1 text-center shadow-2xl backdrop-blur-md max-md:gap-1.5 max-md:px-2.5 max-md:py-0.5 ${
        highlight
          ? 'animate-glow border-amber-300/70 bg-gradient-to-b from-amber-200/95 to-amber-400/95 text-ink-900'
          : 'border-amber-700/50 bg-gray-900/85 text-parchment-100'
      }`}
    >
      <span className="shrink-0 font-display text-[9px] font-bold uppercase tracking-[0.25em] opacity-75 max-md:text-[8px] max-md:tracking-[0.15em]">
        {title}
      </span>
      <span className="h-3 w-px shrink-0 bg-current opacity-25" aria-hidden="true" />
      <span className="truncate text-xs max-md:text-[11px]">
        <span className={`font-display font-bold ${highlight ? '' : colorClass}`}>
          {isMyTurn ? 'You' : actor.name}
        </span>
        {isMyTurn ? `, ${instruction}.` : `: waiting to ${instruction}.`}
      </span>
    </section>
  );
}
