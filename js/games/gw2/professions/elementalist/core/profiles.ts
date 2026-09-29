/**
 * Balance profiles for Core Elementalist: the authored, patch-tunable numbers
 * behind Core mechanics and weapon resources. Traits own their profiles in traits/.
 *
 * Mechanic and skill-variant profiles carry their own ids; trait profiles are
 * keyed by trait id so a profile can be looked up straight from the trait. Code
 * reads required values through the shared balance-profile contract; the
 * authored catalog supplies baseline values when no patch is selected.
 */
import type { BalanceProfile, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/**
 * Stable profile handles for Core Elementalist. Mechanic and skill-variant
 * entries use namespaced string ids; traits use their generated IDs directly.
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
  ragingRicochet: 'elementalist.core.raging-ricochet-bullet',
  searingSalvo: 'elementalist.core.searing-salvo-bullet',
  frozenFusillade: 'elementalist.core.frozen-fusillade-bullet',
  dazingDischarge: 'elementalist.core.dazing-discharge-bullet',
  shatteringStone: 'elementalist.core.shattering-stone-bullet',
  fulgor: 'elementalist.core.fulgor-pulses',
  signetOfFire: 'elementalist.core.signet-of-fire-passive',
  fieryGreatsword: 'elementalist.core.fiery-greatsword-attributes',
  lightningHammer: 'elementalist.core.lightning-hammer-attributes'
});

// Effect-literal builders keep the profile table below readable; the `name`
// is the lookup key callers pass to `requireEffect`.
const namedBoon = (name: string, boon: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon,
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
    name: 'Conjured Weapon Duration',
    profileKind: 'mechanic',
    durationMultiplier: 30,
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
      effects: [
        { type: 'strike', name: 'Water Bullet', coefficient: 0.75, hits: 1 },
        namedCondition('Water Bullet', 'Bleeding', 5, 8)
      ]
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
        name: 'Fulgor',
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
  )
]);
