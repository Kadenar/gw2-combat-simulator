import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const GUARDIAN_CORE_BALANCE_PROFILE_IDS = Object.freeze({ justice: 'guardian.core.justice' });

/** Core and elite virtues consume one shared Justice definition, independent of the active virtue skill. */
export const GUARDIAN_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice,
    name: 'Virtue of Justice',
    profileKind: 'mechanic',
    threshold: 5,
    effects: [
      {
        type: 'condition',
        name: 'Burning (active)',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER,
        packetLabel: 'active'
      },
      {
        type: 'condition',
        name: 'Burning (passive)',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 1.2,
        actorType: ACTOR.PLAYER,
        packetLabel: 'passive'
      }
    ]
  }
]);
