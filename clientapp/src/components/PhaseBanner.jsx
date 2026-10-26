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
export default function PhaseBanner({ game, currentPlayer }) {
  if (!game || !currentPlayer) return null;

  const isSetup = game.phase !== 'MainGame';
  const colorClass = PLAYER_TEXT[currentPlayer.color] ?? 'text-amber-50';

  let title;
  let instruction;

  if (isSetup) {
    title = `Setup Phase &middot; Round ${game.phase === 'SetupRound1' ? 1 : 2}`;
    instruction =
      game.setupStep === 'PlaceRoad'
        ? 'place a road touching your new settlement'
        : `place your ${ORDINAL[game.phase]} settlement`;
  } else {
    title = 'Main Game';
    instruction = game.lastRoll ? 'build, trade, or end your turn' : 'roll the dice';
  }

  return (
    <section
      aria-live="polite"
      className={`rounded-xl px-4 py-3 text-center shadow ${
        isSetup ? 'bg-amber-200/90 text-stone-900' : 'bg-sky-800/70 text-amber-50'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-0.5 text-base font-medium">
        <span className={isSetup ? 'font-bold' : `font-bold ${colorClass}`}>
          {currentPlayer.name} ({currentPlayer.color})
        </span>
        , {instruction}.
      </p>
    </section>
  );
}
