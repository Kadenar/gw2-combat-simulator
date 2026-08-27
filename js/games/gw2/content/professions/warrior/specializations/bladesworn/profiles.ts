import type { BalanceProfile } from '../../../../../platform/engine/types.js';
import { defineTraitProfile as trait } from '../../../../../integrations/patches/authoring/balance-profiles.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '../../data/ids.js';

export const BLADESWORN_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.bladesworn.flow',
  burstMastery: 'warrior.bladesworn.burst-mastery',
  dragonTrigger: 'warrior.bladesworn.dragon-trigger',
  artillerySlash: 'warrior.bladesworn.artillery-slash',
  overchargedCartridges: 'warrior.bladesworn.overcharged-cartridges',
  unseenSword: TRAIT.UNSEEN_SWORD,
  sharpAsTheWind: TRAIT.SHARP_AS_THE_WIND,
  riversFlow: TRAIT.RIVERS_FLOW,
  dragonscaleDefense: TRAIT.DRAGONSCALE_DEFENSE,
  fierceAsFire: TRAIT.FIERCE_AS_FIRE,
  lushForest: TRAIT.LUSH_FOREST,
  gunsAndGlory: TRAIT.GUNS_AND_GLORY
});

export const BLADESWORN_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.resources,
    name: 'Bladesworn Flow',
    profileKind: 'mechanic',
    maximumStacks: 100,
    energyRegenerationPerSecond: 2,
    resourceGain: 4,
    attributePerStack: 2,
    effects: []
  },
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.dragonTrigger,
    name: 'Dragon Trigger Charges',
    profileKind: 'mechanic',
    maximumStacks: 10,
    minimumStacks: 5,
    threshold: 15,
    resourceCost: 5,
    pulseInterval: 0.25,
    cooldown: 30,
    effects: []
  },
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.burstMastery,
    name: 'Bladesworn Burst Mastery Conversion',
    profileKind: 'mechanic',
    resourceGain: 0.2,
    effects: []
  },
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.artillerySlash,
    name: 'Artillery Slash - Ammo Variants',
    profileKind: 'skill-variant',
    parentId: ID.ARTILLERY_SLASH,
    effects: [
      { type: 'strike', coefficient: 2, hits: 1 },
      { type: 'strike', coefficient: 3, hits: 1 },
      { type: 'control', duration: 1 }
    ]
  },
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.overchargedCartridges,
    name: 'Overcharged Cartridges',
    profileKind: 'skill-variant',
    parentId: ID.OVERCHARGED_CARTRIDGES,
    effects: [
      {
        type: 'buff',
        kind: 'overcharged-cartridges',
        stacks: 1,
        duration: 8,
        damageIncreasePerStack: 0.15
      },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 3 },
      {
        type: 'buff',
        kind: 'supercharged-cartridges',
        stacks: 1,
        duration: 8,
        damageIncreasePerStack: 0.2
      },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 5 }
    ]
  },
  trait(BLADESWORN_BALANCE_PROFILE_IDS.unseenSword, 'Unseen Sword', {
    internalCooldown: 4,
    effects: [{ type: 'strike', coefficient: 1.2, hits: 1 }]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.sharpAsTheWind, 'Sharp as the Wind', {
    internalCooldown: 4,
    effects: [{ type: 'condition', condition: 'Burning', stacks: 1, duration: 3 }]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.riversFlow, "River's Flow", {
    internalCooldown: 4,
    effects: [
      { type: 'boon', boon: 'might', stacks: 2, duration: 8 },
      { type: 'buff', kind: 'positive-flow', stacks: 1, duration: 5 }
    ]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.dragonscaleDefense, 'Dragonscale Defense', {
    effects: [{ type: 'boon', boon: 'stability', stacks: 1, duration: 3 }]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.fierceAsFire, 'Fierce as Fire', {
    maximumStacks: 10,
    damageIncreasePerStack: 0.01,
    effects: [{ type: 'buff', kind: 'fierce-as-fire', stacks: 1, duration: 15 }]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.lushForest, 'Lush Forest', {
    rechargeReduction: 0.75
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.gunsAndGlory, 'Guns and Glory', {
    attributeBonus: 250,
    maximumStacks: 12,
    resourceGain: 3
  })
]);
