import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const ASHES_PROFILE = {
  mechanic: 'guardian.firebrand.ashes-of-the-just'
} as const;

// Every grant source uses this trigger interval and baseline Burning payload.
export const ashesMechanic: BalanceProfile = {
  id: ASHES_PROFILE.mechanic,
  name: 'Ashes of the Just: Burning per charge',
  profileKind: 'mechanic',
  internalCooldown: 1,
  effects: [
    {
      type: 'condition',
      name: CONDITION.BURNING,
      condition: CONDITION.BURNING,
      stacks: 1,
      duration: 2,
      actorType: ACTOR.PLAYER
    }
  ]
};
