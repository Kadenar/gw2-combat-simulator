import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

export const BLADESWORN_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.bladesworn.flow',
  burstMastery: 'warrior.bladesworn.burst-mastery',
  dragonTrigger: 'warrior.bladesworn.dragon-trigger',
  artillerySlash: 'warrior.bladesworn.artillery-slash',
  sharpArtillerySlash: 'warrior.bladesworn.sharp-artillery-slash',
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
  // Sharp as the Wind uses one strike value and a Bleeding alternative selected by ammunition spent.
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.sharpArtillerySlash,
    name: 'Artillery Slash — Sharp as the Wind',
    profileKind: 'skill-variant',
    parentId: ID.SHARP_ARTILLERY_SLASH,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 2 },
      {
        name: 'One round',
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6,
        packetLabel: 'one round spent'
      },
      {
        name: 'Two rounds',
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 7,
        packetLabel: 'two rounds spent'
      },
      // The charge-dependent control packet can be removed independently of strike and Bleeding.
      { name: 'Control', type: 'control' }
    ]
  },
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
      { name: 'One round', type: 'strike', coefficient: 2, hits: 1 },
      { name: 'Two rounds', type: 'strike', coefficient: 3, hits: 1 },
      { name: 'Control', type: 'control' }
    ]
  },
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.overchargedCartridges,
    name: 'Overcharged Cartridges',
    profileKind: 'skill-variant',
    parentId: ID.OVERCHARGED_CARTRIDGES,
    effects: [
      {
        name: 'overcharged-cartridges',
        type: 'buff',
        kind: 'overcharged-cartridges',
        stacks: 1,
        duration: 8,
        damageIncreasePerStack: 0.15
      },
      { name: 'Overcharged Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 3 },
      {
        name: 'supercharged-cartridges',
        type: 'buff',
        kind: 'supercharged-cartridges',
        stacks: 1,
        duration: 8,
        damageIncreasePerStack: 0.2
      },
      { name: 'Supercharged Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 5 }
    ]
  },
  trait(BLADESWORN_BALANCE_PROFILE_IDS.unseenSword, 'Unseen Sword', {
    internalCooldown: 4,
    // Entry traits declare their own flow window so patches can remove it independently.
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 1.2, hits: 1 },
      { name: 'positive-flow', type: 'buff', kind: 'positive-flow', stacks: 1, duration: 5 }
    ]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.sharpAsTheWind, 'Sharp as the Wind', {
    internalCooldown: 4,
    effects: [
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 3 },
      { name: 'positive-flow', type: 'buff', kind: 'positive-flow', stacks: 2, duration: 5 }
    ]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.riversFlow, "River's Flow", {
    internalCooldown: 4,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 2, duration: 8 },
      { name: 'positive-flow', type: 'buff', kind: 'positive-flow', stacks: 1, duration: 5 }
    ]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.dragonscaleDefense, 'Dragonscale Defense', {
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 3 }]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.fierceAsFire, 'Fierce as Fire', {
    maximumStacks: 10,
    damageIncreasePerStack: 0.01,
    effects: [{ name: 'fierce-as-fire', type: 'buff', kind: 'fierce-as-fire', stacks: 1, duration: 15 }]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.lushForest, 'Lush Forest', {
    rechargeReduction: 0.75
  }),
  // Trait tuning is shared by build calculations, combat, and tooltips.
  trait(TRAIT.DARING_DRAGON, 'Daring Dragon', {
    resourceCostMultiplier: 2,
    effects: [
      {
        name: 'alacrity',
        type: 'boon',
        boon: 'alacrity',
        stacks: 1,
        duration: 10,
        audience: { recipients: 'party' },
        packetLabel: 'on Dragon Slash release'
      }
    ]
  }),
  trait(BLADESWORN_BALANCE_PROFILE_IDS.gunsAndGlory, 'Guns and Glory', {
    attributeBonus: 250,
    maximumStacks: 12,
    resourceGain: 3
  })
]);
