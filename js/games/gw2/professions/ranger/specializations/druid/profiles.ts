import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

export const DRUID_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'ranger.druid.resources',
  naturalMender: TRAIT.NATURAL_MENDER,
  naturalBalance: TRAIT.NATURAL_BALANCE,
  graceOfTheLand: TRAIT.GRACE_OF_THE_LAND,
  eclipse: TRAIT.ECLIPSE,
  bloodMoon: TRAIT.BLOOD_MOON,
  naturalFortitude: TRAIT.NATURAL_FORTITUDE
});

export const DRUID_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: DRUID_BALANCE_PROFILE_IDS.resources,
    name: 'Celestial Avatar and Astral Force',
    profileKind: 'mechanic',
    maximumStacks: 100,
    durationMultiplier: 15,
    astralForceRetentionMultiplier: 0.5,
    resourceGain: 0.75,
    coefficientMultiplier: 2,
    effects: []
  },
  trait(DRUID_BALANCE_PROFILE_IDS.naturalMender, 'Natural Mender', {
    pulseInterval: 3,
    resourceGain: 8
  }),
  trait(DRUID_BALANCE_PROFILE_IDS.naturalBalance, 'Natural Balance', {
    effects: [{ type: 'buff', kind: 'natural-balance', duration: 10, stacks: 1 }]
  }),
  trait(DRUID_BALANCE_PROFILE_IDS.graceOfTheLand, 'Grace of the Land', {
    effects: [{ type: 'boon', boon: 'alacrity', duration: 1, stacks: 1 }]
  }),
  trait(DRUID_BALANCE_PROFILE_IDS.eclipse, 'Eclipse', {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 1
      },
      { type: 'condition', condition: 'Poisoned', duration: 8, stacks: 3 },
      {
        type: 'condition',
        condition: 'Immobilized',
        duration: 3,
        stacks: 1
      },
      { type: 'condition', condition: 'Chilled', duration: 2, stacks: 1 },
      { type: 'condition', condition: 'Burning', duration: 5, stacks: 1 },
      { type: 'condition', condition: 'Burning', duration: 5, stacks: 3 }
    ]
  }),
  trait(DRUID_BALANCE_PROFILE_IDS.bloodMoon, 'Blood Moon', {
    effects: [{ type: 'condition', condition: 'Bleeding', duration: 4, stacks: 2 }]
  }),
  trait(DRUID_BALANCE_PROFILE_IDS.naturalFortitude, 'Natural Fortitude', {
    attributeBonus: 240
  })
]);
