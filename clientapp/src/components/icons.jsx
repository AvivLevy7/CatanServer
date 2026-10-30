/**
 * Flat SVG icon set for the floating HUD. Every icon inherits `currentColor` and takes
 * its size from the caller's `className`, so a chip can swap label text for a glyph
 * without any other styling change.
 */

function Icon({ className = 'size-4', filled = false, children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Victory points. */
export function StarIcon(props) {
  return (
    <Icon filled {...props}>
      <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.4l-5.8 3.1 1.1-6.45-4.7-4.6 6.5-.95z" />
    </Icon>
  );
}

/** Knights played / Largest Army: a visored knight helm. */
export function KnightIcon(props) {
  return (
    <Icon filled {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.6c-3.5 0-5.9 2.3-5.9 5.7v3.3l-1.3 2.5c-.3.6.1 1.4.9 1.4h2.4l.8 3.3c.1.5.5.8 1 .8h4.2c.5 0 .9-.3 1-.8l.8-3.3h2.4c.8 0 1.2-.8.9-1.4l-1.3-2.5V8.3c0-3.4-2.4-5.7-5.9-5.7ZM7.7 8h8.6v1.6H7.7V8Zm0 3.1h8.6v1.6H7.7v-1.6Z"
      />
    </Icon>
  );
}

/** Longest Road: a road running to the horizon, centre line and all. */
export function RoadIcon(props) {
  return (
    <Icon filled {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.7 2.8h6.6l3.6 18.4H4.1L8.7 2.8Zm2.2 2.9h2.2v3h-2.2v-3Zm-.2 5h2.6v3h-2.6v-3Zm-.3 5h3.2v3h-3.2v-3Z"
      />
    </Icon>
  );
}

/** Resource cards in hand. */
export function CardsIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="12" height="16" rx="2.2" />
      <path d="M15.1 2.9l3.9.9a2 2 0 0 1 1.5 2.4l-2.4 10.5" />
    </Icon>
  );
}

/** Unplayed development cards. */
export function DevCardIcon(props) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="3" width="15" height="18" rx="2.4" />
      <path d="M12 7.3l1.1 3 3 1.1-3 1.1-1.1 3-1.1-3-3-1.1 3-1.1z" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** Dice: a five-pip face. */
export function DiceIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.2" />
      <g fill="currentColor" stroke="none">
        <circle cx="8.6" cy="8.6" r="1.35" />
        <circle cx="15.4" cy="8.6" r="1.35" />
        <circle cx="12" cy="12" r="1.35" />
        <circle cx="8.6" cy="15.4" r="1.35" />
        <circle cx="15.4" cy="15.4" r="1.35" />
      </g>
    </Icon>
  );
}

/** Trade: goods changing hands. */
export function TradeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.5 8.5h13M13 5l3.5 3.5L13 12" />
      <path d="M20.5 15.5h-13M11 12l-3.5 3.5L11 19" />
    </Icon>
  );
}

/** End turn: skip ahead to the next player. */
export function EndTurnIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5.5 5.2l9.3 6.8-9.3 6.8z" fill="currentColor" stroke="none" />
      <path d="M18.5 4.8v14.4" />
    </Icon>
  );
}

/** Buy / add. */
export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5.2v13.6M5.2 12h13.6" />
    </Icon>
  );
}

export function FullscreenEnterIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 9V5.6A1.6 1.6 0 0 1 5.6 4H9" />
      <path d="M15 4h3.4A1.6 1.6 0 0 1 20 5.6V9" />
      <path d="M20 15v3.4a1.6 1.6 0 0 1-1.6 1.6H15" />
      <path d="M9 20H5.6A1.6 1.6 0 0 1 4 18.4V15" />
    </Icon>
  );
}

export function FullscreenExitIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9 4v3.4A1.6 1.6 0 0 1 7.4 9H4" />
      <path d="M20 9h-3.4A1.6 1.6 0 0 1 15 7.4V4" />
      <path d="M15 20v-3.4a1.6 1.6 0 0 1 1.6-1.6H20" />
      <path d="M4 15h3.4A1.6 1.6 0 0 1 9 16.6V20" />
    </Icon>
  );
}

/** Marks the seat whose turn it is. */
export function CrownIcon(props) {
  return (
    <Icon filled {...props}>
      <path d="M2.8 7.3l3.6 3.1L12 4.2l5.6 6.2 3.6-3.1-1.7 10a1 1 0 0 1-1 .8H5.5a1 1 0 0 1-1-.8l-1.7-10Z" />
    </Icon>
  );
}

/** Leave the room. */
export function ExitIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14.5 4h3.9A1.6 1.6 0 0 1 20 5.6v12.8a1.6 1.6 0 0 1-1.6 1.6h-3.9" />
      <path d="M9.6 8.2L5.8 12l3.8 3.8M5.8 12h8.2" />
    </Icon>
  );
}

/** Game log. */
export function ScrollIcon(props) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="3" width="15" height="18" rx="2.2" />
      <path d="M8.2 7.8h7.6M8.2 11.6h7.6M8.2 15.4h4.4" />
    </Icon>
  );
}

/** Chat. */
export function ChatIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20.5 11.3c0 4-3.8 7.3-8.5 7.3a9.6 9.6 0 0 1-2.4-.3L4.6 20.5l1.1-3.4A7 7 0 0 1 3.5 11.3C3.5 7.2 7.3 4 12 4s8.5 3.2 8.5 7.3Z" />
    </Icon>
  );
}

/** Dice statistics. */
export function ChartIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 20.2h16" />
      <path d="M7 20.2v-6.6M12 20.2V5.5M17 20.2v-9.8" />
    </Icon>
  );
}

export function SoundOnIcon(props) {
  return (
    <Icon {...props}>
      <path d="M11 4.8 6.6 8.6H3.8v6.8h2.8L11 19.2z" />
      <path d="M15.2 9.2a4 4 0 0 1 0 5.6M18 6.4a8 8 0 0 1 0 11.2" />
    </Icon>
  );
}

export function SoundOffIcon(props) {
  return (
    <Icon {...props}>
      <path d="M11 4.8 6.6 8.6H3.8v6.8h2.8L11 19.2z" />
      <path d="M15.4 9.8l4.8 4.4M20.2 9.8l-4.8 4.4" />
    </Icon>
  );
}

/** Turn clock. */
export function ClockIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4V12l3.2 2" />
    </Icon>
  );
}
