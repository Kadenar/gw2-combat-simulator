/**
 * Balance profiles for Core Elementalist: the authored, patch-tunable numbers
 * behind every Core mechanic, weapon resource, and trait.
 *
 * Mechanic and skill-variant profiles carry their own ids; trait profiles are
 * keyed by trait id so a profile can be looked up straight from the trait. Code
 * reads these through the shared balance-profile accessors and always passes
 * a hardcoded fallback, so a build with no patch data still simulates.
 */
import type { BalanceProfile, SkillEffect } from '#gw2/platform/engine/types.js';
import {
  defineSkillVariantProfile as variant,
  defineTraitProfile as trait
} from '#gw2/integrations/patches/authoring/balance-profiles.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/elementalist/data/ids.js';

/**
 * Stable profile handles for Core Elementalist. Mechanic and skill-variant
 * entries use namespaced string ids; trait entries alias the trait id itself.
 */
export const ELEMENTALIST_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'elementalist.core.resources',
  summonedElemental: 'elementalist.core.summoned-elemental',
  conjurePickups: 'elementalist.core.conjure-pickups',
  hammerOrbs: 'elementalist.core.hammer-orbs',
  spearEmpowerments: 'elementalist.core.spear-empowerments',
  rockBarrier: 'elementalist.core.rock-barrier-state',
  elementalExplosion: 'elementalist.core.elemental-explosion-auras',
  rideTheLightning: 'elementalist.core.ride-the-lightning-hit',
  arcaneEcho: 'elementalist.core.arcane-echo-window',
  grandFinale: 'elementalist.core.grand-finale',
  ragingRicochet: 'elementalist.core.raging-ricochet-bullet',
  searingSalvo: 'elementalist.core.searing-salvo-bullet',
  frozenFusillade: 'elementalist.core.frozen-fusillade-bullet',
  dazingDischarge: 'elementalist.core.dazing-discharge-bullet',
  shatteringStone: 'elementalist.core.shattering-stone-bullet',
  fulgor: 'elementalist.core.fulgor-pulses',
  signetOfFire: 'elementalist.core.signet-of-fire-passive',
  fieryGreatsword: 'elementalist.core.fiery-greatsword-attributes',
  lightningHammer: 'elementalist.core.lightning-hammer-attributes',
  empoweringFlame: TRAIT.EMPOWERING_FLAME,
  burningPrecision: TRAIT.BURNING_PRECISION,
  conjurer: TRAIT.CONJURER,
  sunspot: TRAIT.SUNSPOT,
  burningRage: TRAIT.BURNING_RAGE,
  smotheringAuras: TRAIT.SMOTHERING_AURAS,
  powerOverwhelming: TRAIT.POWER_OVERWHELMING,
  pyromancersTraining: TRAIT.PYROMANCERS_TRAINING,
  persistingFlames: TRAIT.PERSISTING_FLAMES,
  pyromancersPuissance: TRAIT.PYROMANCERS_PUISSANCE,
  zephyrsSpeed: TRAIT.ZEPHYRS_SPEED,
  freshAir: TRAIT.FRESH_AIR,
  zephyrsBoon: TRAIT.ZEPHYRS_BOON,
  oneWithAir: TRAIT.ONE_WITH_AIR,
  ferociousWinds: TRAIT.FEROCIOUS_WINDS,
  electricDischarge: TRAIT.ELECTRIC_DISCHARGE,
  inscription: TRAIT.INSCRIPTION,
  ragingStorm: TRAIT.RAGING_STORM,
  aeromancersTraining: TRAIT.AEROMANCERS_TRAINING,
  lightningRod: TRAIT.LIGHTNING_ROD,
  earthsEmbrace: TRAIT.EARTHS_EMBRACE,
  serratedStones: TRAIT.SERRATED_STONES,
  elementalShielding: TRAIT.ELEMENTAL_SHIELDING,
  earthenBlast: TRAIT.EARTHEN_BLAST,
  strengthOfStone: TRAIT.STRENGTH_OF_STONE,
  rockSolid: TRAIT.ROCK_SOLID,
  geomancersTraining: TRAIT.GEOMANCERS_TRAINING,
  writtenInStone: TRAIT.WRITTEN_IN_STONE,
  soothingIce: TRAIT.SOOTHING_ICE,
  aquamancersTraining: TRAIT.AQUAMANCERS_TRAINING,
  soothingPower: TRAIT.SOOTHING_POWER,
  arcaneProwess: TRAIT.ARCANE_PROWESS,
  arcanePrecision: TRAIT.ARCANE_PRECISION,
  renewingStamina: TRAIT.RENEWING_STAMINA,
  elementalAttunement: TRAIT.ELEMENTAL_ATTUNEMENT,
  elementalLockdown: TRAIT.ELEMENTAL_LOCKDOWN,
  elementalEnchantment: TRAIT.ELEMENTAL_ENCHANTMENT,
  evasiveArcana: TRAIT.EVASIVE_ARCANA,
  arcaneLightning: TRAIT.ARCANE_LIGHTNING,
  bountifulPower: TRAIT.BOUNTIFUL_POWER
});

// Effect-literal builders keep the profile table below readable; the `name`
// is the lookup key callers pass to `balanceProfileEffectFromContext`.
const namedBoon = (name: string, boon: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon,
  stacks,
  duration
});

const namedBuff = (name: string, kind: string, stacks: number, duration: number): SkillEffect => ({
  type: 'buff',
  name,
  kind,
  stacks,
  duration
});

const namedCondition = (name: string, condition: string, stacks: number, duration: number): SkillEffect => ({
  type: 'condition',
  name,
  condition,
  stacks,
  duration
});

const aura = (name: string, auraName: string, duration: number): SkillEffect => ({
  type: 'buff',
  name,
  kind: auraName,
  stacks: 1,
  duration
});

/**
 * The authored Core profile table registered with the module's catalog data.
 * Multi-element traits and skills list one effect per element, named after that
 * element so handlers can select the branch that fired.
 */
export const ELEMENTALIST_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Elementalist Attunement and Endurance',
    profileKind: 'mechanic',
    maximumStacks: 100,
    resourceCost: 50,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5,
    recharge: 10,
    initialDelay: 1.5,
    durationMultiplier: 4,
    effects: []
  },
  {
    id: ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.summonedElemental,
    name: 'Summoned Elemental Lifecycle',
    profileKind: 'mechanic',
    durationMultiplier: 120,
    recharge: 40,
    initialDelay: 0.16,
    effects: []
  },
  {
    id: ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.conjurePickups,
    name: 'Conjured Weapon Pickup',
    profileKind: 'mechanic',
    durationMultiplier: 35,
    effects: []
  },
  {
    id: ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.hammerOrbs,
    name: 'Elementalist Hammer Orbs',
    profileKind: 'mechanic',
    durationMultiplier: 15,
    initialDelay: 0.48,
    effects: []
  },
  {
    id: ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.spearEmpowerments,
    name: 'Elementalist Spear Empowerments',
    profileKind: 'mechanic',
    damageMultiplier: 1.2,
    rechargeMultiplier: 0.67,
    maximumStacks: 3,
    playerStacks: 3,
    effects: []
  },
  variant(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.rockBarrier, ID.ROCK_BARRIER, 'Rock Barrier - Stored Barrier', {
    durationMultiplier: 30
  }),
  variant(
    ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.elementalExplosion,
    ID.ELEMENTAL_EXPLOSION,
    'Elemental Explosion - Attunement Aura',
    {
      effects: [
        aura('Fire', 'Fire Aura', 4),
        aura('Water', 'Frost Aura', 4),
        aura('Air', 'Shocking Aura', 3),
        aura('Earth', 'Magnetic Aura', 3)
      ]
    }
  ),
  variant(
    ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.rideTheLightning,
    ID.RIDE_THE_LIGHTNING,
    'Ride the Lightning - Hit Recharge',
    { rechargeMultiplier: 0.5 }
  ),
  variant(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.arcaneEcho, ID.ARCANE_ECHO, 'Arcane Echo - Cooldown Window', {
    durationMultiplier: 10,
    recharge: 1
  }),
  variant(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.grandFinale, ID.GRAND_FINALE, 'Grand Finale - Active Orb Packets', {
    initialDelay: 0.68,
    effects: [
      { type: 'strike', name: 'Fire', coefficient: 1.4, hits: 1 },
      namedCondition('Fire', 'Burning', 2, 5),
      { type: 'strike', name: 'Water', coefficient: 1.4, hits: 1 },
      namedCondition('Water', 'Vulnerability', 6, 10),
      { type: 'strike', name: 'Air', coefficient: 1.4, hits: 1 },
      namedCondition('Air', 'Weakness', 1, 5),
      { type: 'strike', name: 'Earth', coefficient: 1.4, hits: 1 },
      namedCondition('Earth', 'Bleeding', 4, 5)
    ]
  }),
  variant(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.ragingRicochet, ID.RAGING_RICOCHET, 'Raging Ricochet - Fire Bullet', {
    effects: [namedBoon('Fire', 'Might', 1, 10)]
  }),
  variant(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.searingSalvo, ID.SEARING_SALVO, 'Searing Salvo - Fire Bullet', {
    effects: [aura('Fire', 'Fire Aura', 4)]
  }),
  variant(
    ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.frozenFusillade,
    ID.FROZEN_FUSILLADE,
    'Frozen Fusillade - Water Bullet',
    {
      initialDelay: 4,
      effects: [{ type: 'strike', coefficient: 0.75, hits: 1 }, namedCondition('Water Bullet', 'Bleeding', 5, 8)]
    }
  ),
  variant(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.dazingDischarge, ID.DAZING_DISCHARGE, 'Dazing Discharge - Air Bullet', {
    durationMultiplier: 5,
    rechargeMultiplier: 0.67
  }),
  variant(
    ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.shatteringStone,
    ID.SHATTERING_STONE,
    'Shattering Stone - Earth Bullet',
    {
      maximumStacks: 3,
      durationMultiplier: 10,
      effects: [namedCondition('Triggered Bleeding', 'Bleeding', 1, 5)]
    }
  ),
  variant(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.fulgor, ID.FULGOR, 'Fulgor - Pulses', {
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 6 }, (_, index) => ({
          atMs: 320 + index * 1000,
          coefficient: 0,
          flatStrikeBase: 200,
          flatStrikePowerCoeff: 0.4
        }))
      }
    ]
  }),
  variant(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.signetOfFire, ID.SIGNET_OF_FIRE, 'Signet of Fire - Passive', {
    attributeBonus: 180
  }),
  variant(
    ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.fieryGreatsword,
    ID.CONJURE_FIERY_GREATSWORD,
    'Fiery Greatsword - Wielded Attributes',
    { attributeBonus: 180, weaponAttributeBonus: 260 }
  ),
  variant(
    ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.lightningHammer,
    ID.CONJURE_LIGHTNING_HAMMER,
    'Lightning Hammer - Wielded Attributes',
    { attributeBonus: 75, weaponAttributeBonus: 180 }
  ),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.empoweringFlame, 'Empowering Flame', { attributeBonus: 150 }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.burningPrecision, 'Burning Precision', {
    procChance: 0.33,
    internalCooldown: 5,
    durationMultiplier: 20,
    effects: [namedCondition('Burning Precision', 'Burning', 1, 3)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.conjurer, 'Conjurer', {
    effects: [aura('Conjurer', 'Fire Aura', 4)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.sunspot, 'Sunspot', {
    effects: [aura('Sunspot Aura', 'Fire Aura', 3), { type: 'strike', name: 'Sunspot', coefficient: 0.6, hits: 1 }]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.burningRage, 'Burning Rage', {
    attributeBonus: 180,
    durationMultiplier: 20,
    effects: [namedCondition('Sunspot Burning', 'Burning', 2, 4)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.smotheringAuras, 'Smothering Auras', { durationMultiplier: 1.33 }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.powerOverwhelming, 'Power Overwhelming', {
    minimumStacks: 10,
    attributeBonus: 150,
    weaponAttributeBonus: 300
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.pyromancersTraining, "Pyromancer's Training", {
    rechargeMultiplier: 0.8
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.persistingFlames, 'Persisting Flames', {
    maximumStacks: 5,
    damageIncreasePerStack: 0.02,
    durationMultiplier: 15,
    durationPerTier: 2,
    summons: 2
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.pyromancersPuissance, "Pyromancer's Puissance", {
    maximumStacks: 10,
    damageIncreasePerStack: 0.1,
    durationPerTier: 0.5,
    effects: [
      namedBoon('Attunement Might', 'might', 1, 15),
      { type: 'strike', name: 'Flame Expulsion', coefficient: 1, hits: 1 },
      namedCondition('Flame Expulsion', 'Burning', 1, 2)
    ]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.zephyrsSpeed, "Zephyr's Speed", { criticalChance: 0.05 }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.freshAir, 'Fresh Air', {
    attributeBonus: 250,
    effects: [{ type: 'buff', kind: 'fresh-air', stacks: 1, duration: 5 }]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.zephyrsBoon, "Zephyr's Boon", {
    effects: [namedBoon('Fury', 'fury', 1, 5), namedBoon('Swiftness', 'swiftness', 1, 5)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.oneWithAir, 'One with Air', {
    effects: [namedBuff('Superspeed', 'superspeed', 1, 3)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.ferociousWinds, 'Ferocious Winds', { attributeConversion: 0.07 }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.electricDischarge, 'Electric Discharge', {
    effects: [
      {
        type: 'strike',
        name: 'Electric Discharge',
        coefficient: 0.35,
        hits: 1
      },
      namedCondition('Electric Discharge', 'Vulnerability', 1, 8)
    ]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.inscription, 'Inscription', {
    effects: [
      namedBoon('Fire', 'might', 1, 10),
      namedBoon('Water', 'regeneration', 1, 10),
      namedBoon('Air', 'swiftness', 1, 10),
      namedBoon('Earth', 'protection', 1, 3),
      namedBoon('Air Entry', 'resistance', 1, 3)
    ]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.ragingStorm, 'Raging Storm', {
    internalCooldown: 8,
    attributeBonus: 180,
    effects: [namedBoon('Fury', 'fury', 1, 4)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.aeromancersTraining, "Aeromancer's Training", {
    attributeBonus: 150,
    rechargeMultiplier: 0.8
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.lightningRod, 'Lightning Rod', {
    effects: [{ type: 'strike', coefficient: 1.5, hits: 1 }, namedCondition('Lightning Rod', 'Weakness', 1, 4)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.earthsEmbrace, "Earth's Embrace", {
    internalCooldown: 15,
    effects: [namedBoon('Resistance', 'resistance', 1, 4)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.serratedStones, 'Serrated Stones', { durationMultiplier: 20 }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.elementalShielding, 'Elemental Shielding', {
    effects: [namedBoon('Protection', 'protection', 1, 3)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.earthenBlast, 'Earthen Blast', {
    effects: [{ type: 'strike', coefficient: 0.36, hits: 1 }]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.strengthOfStone, 'Strength of Stone', {
    attributeConversion: 0.1,
    internalCooldown: 3,
    effects: [namedCondition('Strength of Stone', 'Bleeding', 3, 10)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.rockSolid, 'Rock Solid', {
    effects: [namedBoon('Stability', 'stability', 1, 3)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.geomancersTraining, "Geomancer's Training", { rechargeMultiplier: 0.8 }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.writtenInStone, 'Written in Stone', {
    effects: [aura('Restoration', 'Frost Aura', 4), aura('Fire', 'Fire Aura', 4), aura('Earth', 'Magnetic Aura', 3)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.soothingIce, 'Soothing Ice', {
    internalCooldown: 15,
    effects: [aura('Frost Aura', 'Frost Aura', 4), namedBoon('Regeneration', 'regeneration', 1, 4)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.aquamancersTraining, "Aquamancer's Training", {
    rechargeMultiplier: 0.8
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.soothingPower, 'Soothing Power', { attributeBonus: 300 }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.arcaneProwess, 'Arcane Prowess', {
    effects: [namedBoon('Might', 'might', 1, 8)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.arcanePrecision, 'Arcane Precision', {
    procChance: 0.33,
    internalCooldown: 3,
    effects: [
      namedCondition('Fire', 'Burning', 1, 1.5),
      namedCondition('Water', 'Vulnerability', 1, 10),
      namedCondition('Air', 'Weakness', 1, 3),
      namedCondition('Earth', 'Bleeding', 1, 5)
    ]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.renewingStamina, 'Renewing Stamina', {
    internalCooldown: 10,
    effects: [namedBoon('Vigor', 'vigor', 1, 5)]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.elementalAttunement, 'Elemental Attunement', {
    effects: [
      namedBoon('Fire', 'might', 1, 15),
      namedBoon('Water', 'regeneration', 1, 5),
      namedBoon('Air', 'swiftness', 1, 8),
      namedBoon('Earth', 'protection', 1, 5)
    ]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.elementalLockdown, 'Elemental Lockdown', {
    internalCooldown: 1,
    effects: [
      namedBoon('Fire', 'might', 5, 5),
      namedBoon('Water', 'regeneration', 1, 10),
      namedBoon('Air', 'fury', 1, 5),
      namedBoon('Earth', 'protection', 1, 4)
    ]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.elementalEnchantment, 'Elemental Enchantment', {
    attributeBonus: 180,
    rechargeMultiplier: 0.85
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.evasiveArcana, 'Evasive Arcana', {
    internalCooldown: 10,
    effects: [
      {
        type: 'strike',
        name: 'Fire',
        coefficient: 1,
        hits: 1
      },
      namedCondition('Fire Burning', 'Burning', 3, 6),
      { type: 'strike', name: 'Earth', coefficient: 0.5, hits: 1 },
      namedCondition('Earth Bleeding', 'Bleeding', 1, 20),
      namedCondition('Earth Cripple', 'Cripple', 1, 2)
    ]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.arcaneLightning, 'Arcane Lightning', {
    attributeBonus: 150,
    effects: [
      {
        type: 'buff',
        name: 'Arcane Lightning',
        kind: 'arcane-lightning',
        stacks: 1,
        duration: 15
      },
      namedBoon('Arcane Brilliance', 'protection', 1, 3.5),
      namedCondition('Arcane Wave', 'Immobilized', 1, 2),
      namedBoon('Arcane Echo', 'quickness', 1, 4)
    ]
  }),
  trait(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.bountifulPower, 'Bountiful Power', {
    threshold: 5,
    effects: [
      namedBoon('Quickness', 'quickness', 1, 5),
      {
        type: 'buff',
        name: 'Damage Window',
        kind: 'bountiful-power-active',
        stacks: 1,
        duration: 7
      }
    ]
  })
]);
