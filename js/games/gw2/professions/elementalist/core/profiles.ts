import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/elementalist/core/profile-ids.js';
/**
 * Balance profiles for Core Elementalist: the authored, patch-tunable numbers
 * behind Core mechanics and weapon resources. Traits own their profiles in traits/.
 *
 * Mechanic and skill-variant profiles carry their own ids; trait profiles are
 * keyed by trait id so a profile can be looked up straight from the trait. Code
 * reads required values through the shared balance-profile contract; the
 * authored catalog supplies baseline values when no patch is selected.
 */
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/profile-authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

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
