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
        name: 'Burning',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'buff',
        name: 'ashes-of-the-just',
        kind: 'ashes-of-the-just',
        stacks: 2,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'boon',
        name: 'might',
        boon: 'might',
        stacks: 8,
        duration: 10,
        actorType: 'player'
      }
    ]
  },

  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.passiveCourage,
    name: 'Tome of Courage - Passive',
    profileKind: 'mechanic',
    pulseInterval: 40,
    effects: [{ type: 'boon', name: 'aegis', boon: 'aegis', stacks: 1, duration: 40 }]
  }
]);
