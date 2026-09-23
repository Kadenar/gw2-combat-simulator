import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

export const ENGINEER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'engineer.core.resources',
  lightningRod: 'engineer.core.lightning-rod',
  focusedLightningRod: 'engineer.core.focused-lightning-rod',
  conduitSurge: 'engineer.core.conduit-surge',
  electricArtillery: 'engineer.core.electric-artillery',
  focusedElectricArtillery: 'engineer.core.focused-electric-artillery',
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
  // Resolver-owned spear packets share their selected declarations with presentation.
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.lightningRod,
    name: 'Lightning Rod Pulse',
    profileKind: 'skill-variant',
    effects: [
      { name: 'Lightning Rod Pulse', type: 'strike', coefficient: 0.17, hits: 1 },
      { name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8 }
    ]
  },
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.focusedLightningRod,
    name: 'Focused Lightning Rod Pulse',
    profileKind: 'skill-variant',
    effects: [
      { name: 'Focused Lightning Rod Pulse', type: 'strike', coefficient: 0.3, hits: 1 },
      { name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 2, duration: 8 }
    ]
  },
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.conduitSurge,
    name: 'Conduit Surge',
    profileKind: 'skill-variant',
    durationMultiplier: 10,
    effects: [
      { name: 'Conduit Surge', type: 'strike', coefficient: 1.2, hits: 1 },
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 7 }
    ]
  },
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.electricArtillery,
    name: 'Electric Artillery',
    profileKind: 'skill-variant',
    maximumStacks: 12,
    chargesPerVulnerability: 2,
    burningDurationPerCharge: 0.25,
    effects: [
      { name: 'Electric Artillery', type: 'strike', coefficient: 1, hits: 1 },
      { name: 'Immobilized', type: 'condition', condition: 'Immobilized', stacks: 1, duration: 2 },
      { name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8 },
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 2, duration: 3 }
    ]
  },
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.focusedElectricArtillery,
    name: 'Focused Electric Artillery',
    profileKind: 'skill-variant',
    maximumStacks: 12,
    chargesPerVulnerability: 1,
    burningDurationPerCharge: 0.5,
    effects: [
      { name: 'Focused Electric Artillery', type: 'strike', coefficient: 1.5, hits: 1 },
      { name: 'Immobilized', type: 'condition', condition: 'Immobilized', stacks: 1, duration: 2 },
      { name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8 },
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 2, duration: 3 }
    ]
  },
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
    effects: [{ name: 'Grenadier', type: 'strike', coefficient: 0.5, hits: 6, atMs: 0 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.streamlinedKits, 'Streamlined Kits', {
    internalCooldown: 20,
    effects: [
      { name: 'swiftness', type: 'boon', boon: 'swiftness', stacks: 1, duration: 20 },
      { name: 'Streamlined Kits', type: 'strike', coefficient: 1.75, hits: 1 }
    ]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.optimizedActivation, 'Optimized Activation', {
    effects: [{ name: 'vigor', type: 'boon', boon: 'vigor', stacks: 1, duration: 4 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.staticDischarge, 'Static Discharge', {
    criticalDamage: 2,
    effects: [{ name: 'Static Discharge', type: 'strike', coefficient: 0.33, hits: 1 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.kineticBattery, 'Kinetic Battery', {
    maximumStacks: 5,
    effects: [
      { name: 'kinetic-battery', type: 'buff', kind: 'kinetic-battery', stacks: 1, duration: 5 },
      { name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      // Superspeed accompanies the fifth charge without boon-duration scaling.
      { name: 'superspeed', type: 'buff', kind: 'superspeed', stacks: 1, duration: 5 }
    ]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.explosiveEntrance, 'Explosive Entrance', {
    effects: [{ name: 'Explosive Entrance', type: 'strike', coefficient: 1.25, hits: 1 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.steelPackedPowder, 'Steel-Packed Powder', {
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.shortFuse, 'Short Fuse', {
    internalCooldown: 3,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 4 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.explosiveTemper, 'Explosive Temper', {
    maximumStacks: 10,
    attributePerStack: 20,
    effects: [{ name: 'explosive-temper', type: 'buff', kind: 'explosive-temper', stacks: 1, duration: 10 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.shrapnel, 'Shrapnel', {
    procRate: {
      id: 'engineer.shrapnel',
      traitId: TRAIT.SHRAPNEL,
      field: 'procChance',
      opportunity: 'eligible explosion hit'
    },
    procChance: 0.33,
    effects: [
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6 },
      { name: 'Crippled', type: 'condition', condition: 'Crippled', stacks: 1, duration: 1 }
    ]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.serratedSteel, 'Serrated Steel', {
    procRate: {
      id: 'engineer.serrated-steel',
      traitId: TRAIT.SERRATED_STEEL,
      field: 'procChance',
      opportunity: 'eligible critical hit'
    },
    procChance: 0.33,
    durationMultiplier: 0.33,
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.noScope, 'No Scope', {
    internalCooldown: 8,
    attributeBonus: 150,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 4 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.incendiaryPowder, 'Incendiary Powder', {
    internalCooldown: 10,
    durationMultiplier: 0.33,
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 8 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.aimAssistedRocket, 'Aim-Assisted Rocket', {
    internalCooldown: 3,
    maximumStacks: 5,
    effects: [
      {
        name: 'Rocket',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        name: 'Orbital Strike',
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
    effects: [{ name: 'thermal-vision', type: 'buff', kind: 'thermal-vision', stacks: 1, duration: 4 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.sanguineArray, 'Sanguine Array', {
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 1, duration: 4 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.hematicFocus, 'Hematic Focus', {
    criticalChance: 0.15,
    internalCooldown: 8,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 8 }]
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.chemicalRounds, 'Chemical Rounds', {
    conditionDurationMultiplier: 4 / 3,
    attributeBonus: 120
  }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.energyAmplifier, 'Energy Amplifier', {
    attributeBonus: 250
  }),
  trait(TRAIT.HIGH_CALIBER, 'High Caliber', {
    criticalChance: 0.15
  }),
  trait(TRAIT.GRAND_ENTRANCE, 'Grand Entrance', {
    criticalChance: 0.1
  }),
  trait(TRAIT.HEAVY_METAL, 'Heavy Metal', {
    lowerThreshold: 0.25,
    middleThreshold: 0.5,
    upperThreshold: 0.75,
    lowerBonus: 0.15,
    middleBonus: 0.1,
    upperBonus: 0.05
  }),
  // Trait tuning is shared by build calculations, combat, and tooltips.
  trait(TRAIT.HGH, 'HGH', {
    durationMultiplier: 1.2,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 2, duration: 12 },
      { name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 4 },
      { name: 'HGH', type: 'strike', coefficient: 0.85, hits: 1, packetLabel: 'additional Acid Bomb strike' }
    ]
  }),
  trait(TRAIT.ADRENAL_IMPLANT, 'Adrenal Implant', { rechargeReduction: 1 }),
  trait(TRAIT.POWER_WRENCH, 'Power Wrench', { rechargeReduction: 3 }),
  trait(TRAIT.GADGETEER, 'Gadgeteer', { rechargeMultiplier: 0.8 }),
  trait(TRAIT.MECHANIZED_DEPLOYMENT, 'Mechanized Deployment', { rechargeMultiplier: 0.85 }),
  trait(TRAIT.COMPOUNDING_CHEMICALS, 'Compounding Chemicals', { attributeBonus: 240 }),
  trait(TRAIT.BLAST_SHIELD, 'Blast Shield', { attributeConversion: 0.1 }),
  trait(ENGINEER_CORE_BALANCE_PROFILE_IDS.sharpshooter, 'Sharpshooter', {
    coefficientMultiplier: 2 / 3
  })
]);
