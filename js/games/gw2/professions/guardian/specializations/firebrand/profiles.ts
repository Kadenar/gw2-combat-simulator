import {
  ashesMechanic,
  epilogueAshesGrant
} from '#gw2/professions/guardian/specializations/firebrand/ashes-profiles.js';
import { BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

export const FIREBRAND_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'guardian.firebrand.tome-pages',
  tomeJustice: 'guardian.firebrand.tome-justice',
  tomeResolve: 'guardian.firebrand.tome-resolve',
  tomeCourage: 'guardian.firebrand.tome-courage',
  passiveCourage: 'guardian.firebrand.passive-courage'
});

export const FIREBRAND_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.resources,
    name: 'Firebrand Tome Pages',
    profileKind: 'mechanic',
    maximumStacks: 5,
    pulseInterval: 8,
    // Rework extension point (firebrand-rework): shared mechanics read these optional trait overrides.
    capacityTrait: TRAIT.ARCHIVIST_OF_WHISPERS,
    intervalTrait: TRAIT.LOREMASTER,
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
  epilogueAshesGrant,
  ashesMechanic,

  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.passiveCourage,
    name: 'Tome of Courage - Passive',
    profileKind: 'mechanic',
    pulseInterval: 40,
    effects: [{ type: 'boon', name: boonKey(BOON.AEGIS), boon: BOON.AEGIS, stacks: 1, duration: 40 }]
  }
]);
