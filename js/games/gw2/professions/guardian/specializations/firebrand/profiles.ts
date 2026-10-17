import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const FIREBRAND_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'guardian.firebrand.tome-pages',
  tomeJustice: 'guardian.firebrand.tome-justice',
  tomeResolve: 'guardian.firebrand.tome-resolve',
  tomeCourage: 'guardian.firebrand.tome-courage',
  ashes: 'guardian.firebrand.ashes-of-the-just',
  passiveCourage: 'guardian.firebrand.passive-courage'
});

export const FIREBRAND_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.resources,
    name: 'Firebrand Tome Pages',
    profileKind: 'mechanic',
    maximumStacks: 5,
    pulseInterval: 8,
    effects: []
  },
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.tomeJustice,
    name: 'Tome of Justice - Dormant',
    profileKind: 'mechanic',
    cooldown: 20,
    effects: []
  },
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.tomeResolve,
    name: 'Tome of Resolve - Dormant',
    profileKind: 'mechanic',
    cooldown: 30,
    effects: []
  },
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.tomeCourage,
    name: 'Tome of Courage - Dormant',
    profileKind: 'mechanic',
    cooldown: 45,
    effects: []
  },
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.ashes,
    name: 'Ashes of the Just',
    profileKind: 'skill-variant',
    parentId: ID.ASHES_OF_THE_JUST,
    maximumStacks: 2,
    internalCooldown: 1,
    effects: [
      {
        type: 'condition',
        name: CONDITION.BURNING,
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
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
  },

  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.passiveCourage,
    name: 'Tome of Courage - Passive',
    profileKind: 'mechanic',
    pulseInterval: 40,
    effects: [{ type: 'boon', name: boonKey(BOON.AEGIS), boon: BOON.AEGIS, stacks: 1, duration: 40 }]
  }
]);
