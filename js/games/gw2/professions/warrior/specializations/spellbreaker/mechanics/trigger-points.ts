import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Resolve this accepted event at the specialization hook position. */
export const spellbreakerControlAccepted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.spellbreaker-control-accepted',
  [TRAIT.ATTACKERS_INSIGHT]
);

/** Resolve this accepted event at the specialization hook position. */
export const spellbreakerStrike = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.spellbreaker-strike',
  [TRAIT.MAGEBANE_TETHER]
);
