import { createCombatEngagement } from '#gw2/platform/combat/engagement.js';

/** Direct mechanic fixtures enter through the same transitions as an inherited runtime marker. */
export function enteredCombat(at = 0) {
  const owner = createCombatEngagement({ inheritedStartTime: at });
  owner.dispatchMarker(at);
  owner.acceptEntry(at, true);
  return owner.query;
}
