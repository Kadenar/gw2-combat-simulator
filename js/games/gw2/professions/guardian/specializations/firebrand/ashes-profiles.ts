import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const ASHES_PROFILE = {
  mechanic: 'guardian.firebrand.ashes-of-the-just',
  epilogueGrant: 'guardian.firebrand.epilogue-ashes-grant'
} as const;

// A grant describes what recipients receive, separately from what a charge does.
export const epilogueAshesGrant: BalanceProfile = {
  id: ASHES_PROFILE.epilogueGrant,
  name: 'Epilogue: Ashes charge grant',
  profileKind: 'skill-variant',
  parentId: ID.ASHES_OF_THE_JUST,
  effects: [
    {
      type: 'buff',
      name: 'ashes-of-the-just',
      kind: 'ashes-of-the-just',
      stacks: 2,
      duration: 10,
      actorType: ACTOR.PLAYER
    },
    {
      type: 'boon',
      name: boonKey(BOON.MIGHT),
      boon: BOON.MIGHT,
      stacks: 8,
      duration: 10,
      actorType: ACTOR.PLAYER
    }
  ]
};

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
