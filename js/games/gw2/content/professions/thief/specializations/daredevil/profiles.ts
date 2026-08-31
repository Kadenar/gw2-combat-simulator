import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/integrations/patches/authoring/balance-profiles.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';

export const DAREDEVIL_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'thief.daredevil.resources',
  palmStrike: 'thief.daredevil.palm-strike',
  boundingDodger: TRAIT.BOUNDING_DODGER,
  lotusTraining: TRAIT.LOTUS_TRAINING,
  unhinderedCombatant: TRAIT.UNHINDERED_COMBATANT,
  staffMaster: TRAIT.STAFF_MASTER,
  brawlersTenacity: TRAIT.BRAWLERS_TENACITY,
  weakeningStrikes: TRAIT.WEAKENING_STRIKES
});

export const DAREDEVIL_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: DAREDEVIL_BALANCE_PROFILE_IDS.resources,
    name: 'Daredevil Endurance',
    profileKind: 'mechanic',
    maximumStacks: 150,
    effects: []
  },
  {
    id: DAREDEVIL_BALANCE_PROFILE_IDS.palmStrike,
    name: 'Palm Strike Window',
    profileKind: 'mechanic',
    durationMultiplier: 5,
    effects: []
  },
  trait(DAREDEVIL_BALANCE_PROFILE_IDS.boundingDodger, 'Bounding Dodger', {
    durationMultiplier: 6,
    effects: [{ type: 'strike', coefficient: 3.5, hits: 1 }]
  }),
  trait(DAREDEVIL_BALANCE_PROFILE_IDS.lotusTraining, 'Lotus Training', {
    durationMultiplier: 6,
    effects: [
      { type: 'strike', coefficient: 0.5625, hits: 3 },
      { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 4 },
      { type: 'condition', condition: 'Torment', stacks: 2, duration: 4 },
      { type: 'condition', condition: 'Crippled', stacks: 1, duration: 3 }
    ]
  }),
  trait(DAREDEVIL_BALANCE_PROFILE_IDS.unhinderedCombatant, 'Unhindered Combatant', {
    effects: [{ type: 'boon', boon: 'Swiftness', stacks: 1, duration: 8 }]
  }),
  trait(DAREDEVIL_BALANCE_PROFILE_IDS.staffMaster, 'Staff Master', {
    resourceGain: 2
  }),
  trait(DAREDEVIL_BALANCE_PROFILE_IDS.brawlersTenacity, "Brawler's Tenacity", {
    resourceGain: 15
  }),
  trait(DAREDEVIL_BALANCE_PROFILE_IDS.weakeningStrikes, 'Weakening Strikes', {
    effects: [{ type: 'condition', condition: 'Weakness', stacks: 1, duration: 3 }]
  })
]);
