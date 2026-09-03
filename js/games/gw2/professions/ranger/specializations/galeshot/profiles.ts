import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

export const GALESHOT_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'ranger.galeshot.resources',
  mistral: 'ranger.galeshot.mistral',
  shrike: TRAIT.SHRIKE,
  wutheringWind: TRAIT.WUTHERING_WIND,
  thrillOfTheCatch: TRAIT.THRILL_OF_THE_CATCH,
  flockTogether: TRAIT.FLOCK_TOGETHER,
  cloudburst: TRAIT.CLOUDBURST,
  galeForce: TRAIT.GALE_FORCE
});

export const GALESHOT_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: GALESHOT_BALANCE_PROFILE_IDS.resources,
    name: 'Cyclone Bow Arrows and Wind Force',
    profileKind: 'mechanic',
    maximumStacks: 8,
    minimumStacks: 5,
    pulseInterval: 5,
    effects: []
  },
  {
    id: GALESHOT_BALANCE_PROFILE_IDS.mistral,
    parentId: ID.MISTRAL,
    name: 'Mistral - Missile Trigger',
    profileKind: 'skill-variant',
    durationMultiplier: 6,
    effects: [
      { type: 'strike', coefficient: 0.3, hits: 1 },
      { type: 'condition', condition: 'Chilled', duration: 1, stacks: 1 }
    ]
  },
  trait(GALESHOT_BALANCE_PROFILE_IDS.shrike, 'Shrike', {
    threshold: 12,
    resourceGain: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 3,
        atMs: 0
      }
    ]
  }),
  trait(GALESHOT_BALANCE_PROFILE_IDS.wutheringWind, 'Wuthering Wind', {
    effects: [{ type: 'strike', coefficient: 2, hits: 1 }]
  }),
  trait(GALESHOT_BALANCE_PROFILE_IDS.thrillOfTheCatch, 'Thrill of the Catch', {
    internalCooldown: 0.25,
    resourceGain: 1
  }),
  trait(GALESHOT_BALANCE_PROFILE_IDS.flockTogether, 'Flock Together', {
    internalCooldown: 20,
    effects: [{ type: 'boon', boon: 'quickness', duration: 5, stacks: 1 }]
  }),
  trait(GALESHOT_BALANCE_PROFILE_IDS.cloudburst, 'Cloudburst', {
    effects: [
      { type: 'boon', boon: 'quickness', duration: 4, stacks: 1 },
      { type: 'boon', boon: 'might', duration: 10, stacks: 4 },
      { type: 'boon', boon: 'quickness', duration: 8, stacks: 1 },
      { type: 'boon', boon: 'might', duration: 10, stacks: 8 }
    ]
  }),
  trait(GALESHOT_BALANCE_PROFILE_IDS.galeForce, 'Gale Force', {
    effects: [{ type: 'buff', kind: 'gale-force', duration: 10, stacks: 1 }]
  })
]);
