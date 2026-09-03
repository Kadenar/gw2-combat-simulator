import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

export const ENGINEER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'engineer.core.resources',
  grenadier: TRAIT.GRENADIER,
  streamlinedKits: TRAIT.STREAMLINED_KITS,
  optimizedActivation: TRAIT.OPTIMIZED_ACTIVATION,
  staticDischarge: TRAIT.STATIC_DISCHARGE,
  kineticBattery: TRAIT.KINETIC_BATTERY,
  explosiveEntrance: TRAIT.EXPLOSIVE_ENTRANCE,
  steelPackedPowder: TRAIT.STEEL_PACKED_POWDER,
  shortFuse: TRAIT.SHORT_FUSE,
  explosiveTemper: TRAIT.EXPLOSIVE_TEMPER,
  shrapnel: TRAIT.SHRAPNEL,
  serratedSteel: TRAIT.SERRATED_STEEL,
  noScope: TRAIT.NO_SCOPE,
  incendiaryPowder: TRAIT.INCENDIARY_POWDER,
  aimAssistedRocket: TRAIT.AIM_ASSISTED_ROCKET,
  thermalVision: TRAIT.THERMAL_VISION,
  sanguineArray: TRAIT.SANGUINE_ARRAY,
  hematicFocus: TRAIT.HEMATIC_FOCUS,
  chemicalRounds: TRAIT.CHEMICAL_ROUNDS,
  energyAmplifier: TRAIT.ENERGY_AMPLIFIER,
  sharpshooter: TRAIT.SHARPSHOOTER
});

export const ENGINEER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Engineer Endurance',
    profileKind: 'mechanic',
    maximumStacks: 100,
    resourceCost: 50,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5,
    coefficientMultiplier: 1.25,
    effects: []
  },
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.grenadier, 'Grenadier', {
    internalCooldown: 20,
    effects: [{ type: 'strike', coefficient: 0.5, hits: 6, atMs: 0 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.streamlinedKits, 'Streamlined Kits', {
    internalCooldown: 20,
    effects: [
      { type: 'boon', boon: 'swiftness', stacks: 1, duration: 20 },
      { type: 'strike', coefficient: 1.75, hits: 1 }
    ]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.optimizedActivation, 'Optimized Activation', {
    effects: [{ type: 'boon', boon: 'vigor', stacks: 1, duration: 4 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.staticDischarge, 'Static Discharge', {
    effects: [{ type: 'strike', coefficient: 0.33, hits: 1 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.kineticBattery, 'Kinetic Battery', {
    maximumStacks: 5,
    effects: [
      { type: 'buff', kind: 'kinetic-battery', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'quickness', stacks: 1, duration: 5 }
    ]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.explosiveEntrance, 'Explosive Entrance', {
    effects: [{ type: 'strike', coefficient: 1.25, hits: 1 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.steelPackedPowder, 'Steel-Packed Powder', {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 5
      }
    ]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.shortFuse, 'Short Fuse', {
    internalCooldown: 3,
    effects: [{ type: 'boon', boon: 'fury', stacks: 1, duration: 4 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.explosiveTemper, 'Explosive Temper', {
    maximumStacks: 10,
    attributePerStack: 20,
    effects: [{ type: 'buff', kind: 'explosive-temper', stacks: 1, duration: 10 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.shrapnel, 'Shrapnel', {
    procChance: 0.33,
    effects: [
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6 },
      { type: 'condition', condition: 'Crippled', stacks: 1, duration: 1 }
    ]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.serratedSteel, 'Serrated Steel', {
    procChance: 0.33,
    durationMultiplier: 0.33,
    effects: [{ type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.noScope, 'No Scope', {
    internalCooldown: 8,
    attributeBonus: 150,
    effects: [{ type: 'boon', boon: 'fury', stacks: 1, duration: 4 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.incendiaryPowder, 'Incendiary Powder', {
    internalCooldown: 10,
    durationMultiplier: 0.33,
    effects: [{ type: 'condition', condition: 'Burning', stacks: 1, duration: 8 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.aimAssistedRocket, 'Aim-Assisted Rocket', {
    internalCooldown: 3,
    maximumStacks: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        atMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.thermalVision, 'Thermal Vision', {
    attributeBonus: 150,
    effects: [{ type: 'buff', kind: 'thermal-vision', stacks: 1, duration: 4 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.sanguineArray, 'Sanguine Array', {
    effects: [{ type: 'boon', boon: 'might', stacks: 1, duration: 4 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.hematicFocus, 'Hematic Focus', {
    internalCooldown: 8,
    effects: [{ type: 'boon', boon: 'fury', stacks: 1, duration: 8 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.chemicalRounds, 'Chemical Rounds', {
    attributeBonus: 120
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.energyAmplifier, 'Energy Amplifier', {
    attributeBonus: 250
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.sharpshooter, 'Sharpshooter', {
    coefficientMultiplier: 2 / 3
  })
]);
