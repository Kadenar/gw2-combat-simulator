import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/integrations/patches/authoring/balance-profiles.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';

export const BERSERKER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.berserker.resources',
  rageExtensions: 'warrior.berserker.rage-extensions',
  burstOfAggression: TRAIT.BURST_OF_AGGRESSION,
  bloodyRoar: TRAIT.BLOODY_ROAR,
  lastBlaze: TRAIT.LAST_BLAZE,
  smashBrawler: TRAIT.SMASH_BRAWLER,
  heatTheSoul: TRAIT.HEAT_THE_SOUL,
  kingOfFires: TRAIT.KING_OF_FIRES,
  bloodReaction: TRAIT.BLOOD_REACTION
});

export const BERSERKER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: BERSERKER_BALANCE_PROFILE_IDS.resources,
    name: 'Berserk Mode',
    profileKind: 'mechanic',
    maximumStacks: 10,
    quicknessCastMultiplier: 1.15,
    attributeBonus: 300,
    attributePerStack: 150,
    effects: [{ type: 'buff', kind: 'berserk', stacks: 1, duration: 20 }]
  },
  {
    id: BERSERKER_BALANCE_PROFILE_IDS.rageExtensions,
    name: 'Berserk Rage Extensions',
    profileKind: 'mechanic',
    minimumStacks: 2,
    threshold: 3,
    maximumStacks: 5,
    effects: []
  },
  trait(BERSERKER_BALANCE_PROFILE_IDS.burstOfAggression, 'Burst of Aggression', {
    effects: [
      { type: 'boon', boon: 'quickness', stacks: 1, duration: 3 },
      { type: 'boon', boon: 'fury', stacks: 1, duration: 8 }
    ]
  }),
  trait(BERSERKER_BALANCE_PROFILE_IDS.bloodyRoar, 'Bloody Roar', {
    damageMultiplier: 1.1,
    effects: [{ type: 'boon', boon: 'resistance', stacks: 1, duration: 3.5 }]
  }),
  trait(BERSERKER_BALANCE_PROFILE_IDS.lastBlaze, 'Last Blaze', {
    durationMultiplier: 1,
    effects: [{ type: 'condition', condition: 'Burning', stacks: 1, duration: 4 }]
  }),
  trait(BERSERKER_BALANCE_PROFILE_IDS.smashBrawler, 'Smash Brawler', {
    criticalChance: 0.15,
    resourceGain: 2,
    minimumStacks: 1
  }),
  trait(BERSERKER_BALANCE_PROFILE_IDS.heatTheSoul, 'Heat the Soul', {
    effects: [
      { type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'fury', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'might', stacks: 3, duration: 5 }
    ]
  }),
  trait(BERSERKER_BALANCE_PROFILE_IDS.kingOfFires, 'King of Fires', {
    internalCooldown: 15,
    effects: [
      { type: 'buff', kind: 'fire-aura', stacks: 1, duration: 5 },
      { type: 'strike', coefficient: 0.7, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 3, duration: 3 }
    ]
  }),
  trait(BERSERKER_BALANCE_PROFILE_IDS.bloodReaction, 'Blood Reaction', {
    attributeConversion: 0.12,
    coefficientMultiplier: 0.24
  })
]);
