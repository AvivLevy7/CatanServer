/**
 * Where one player stands on the live offer.
 *
 * The settled answers come from the offer itself, which the server owns; the two softer
 * ones come from the ephemeral negotiation channel and are only ever a hint. Precedence
 * runs from most to least settled, so someone who has accepted reads as accepted even if
 * they still have the panel open in front of them.
 */
export function tradeStatusOf({ playerId, offer, negotiators }) {
  if (!offer) return 'idle';
  if ((offer.acceptedBy ?? []).includes(playerId)) return 'accepted';
  if ((offer.embargoedBy ?? []).includes(playerId)) return 'embargoed';
  if ((offer.declinedBy ?? []).includes(playerId)) return 'declined';
  const activity = negotiators?.[playerId];
  if (activity === 'Countering') return 'countering';
  if (activity === 'Inspecting') return 'reviewing';
  return 'waiting';
}

export const TRADE_STATUS_LABELS = {
  accepted: 'Accepted - click to trade with them',
  embargoed: 'Refusing to trade with the leader',
  declined: 'Declined',
  countering: 'Writing a counter-offer',
  reviewing: 'Reading the offer',
  waiting: 'Has not answered yet',
  idle: 'No offer on the table',
};
