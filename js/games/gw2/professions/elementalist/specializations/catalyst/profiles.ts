/**
 * Balance-profile data for Catalyst: the energy resource, the three augment skill
 * variants, and every Catalyst trait. Mechanics read these through
 * `balanceProfileValueFromContext`/`balanceProfileEffectFromContext`, so patch data can retune
 * Catalyst numbers without touching handler code.
 */
import type { BalanceProfile, SkillEffect } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';

/**
 * Stable ids the mechanics look profiles up by; trait entries reuse the trait id so a
 * trait patch and its profile address the same record.
 */
export const CATALYST_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'elementalist.catalyst.resources',
  relentlessFire: 'elementalist.catalyst.relentless-fire',
  shatteringIce: 'elementalist.catalyst.shattering-ice',
  elementalCelerity: 'elementalist.catalyst.elemental-celerity',
  depthOfElements: TRAIT.DEPTH_OF_ELEMENTS,
  viciousEmpowerment: TRAIT.VICIOUS_EMPOWERMENT,
  energizedElements: TRAIT.ENERGIZED_ELEMENTS,
  elementalEmpowerment: TRAIT.ELEMENTAL_EMPOWERMENT,
  empoweringAuras: TRAIT.EMPOWERING_AURAS,
  spectacularSphere: TRAIT.SPECTACULAR_SPHERE,
  elementalEpitome: TRAIT.ELEMENTAL_EPITOME,
  elementalSynergy: TRAIT.ELEMENTAL_SYNERGY,
  sphereSpecialist: TRAIT.SPHERE_SPECIALIST
});

// Named boon/aura effect shorthands; `name` is the lookup key handlers pass to
// balanceProfileEffectFromContext (usually the attunement), not the buff itself.
const boon = (name: string, boonName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon: boonName,
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
 * The Catalyst profile table. `resources` carries the energy cap, the Jade Sphere
 * cost and the per-hit gain; the augment variants carry their buff windows; each
 * trait entry carries its internal cooldown and the effects its handler emits.
 */
export const CATALYST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: CATALYST_BALANCE_PROFILE_IDS.resources,
    name: 'Catalyst Energy',
    profileKind: 'mechanic',
    maximumStacks: 30,
    resourceCost: 10,
    resourceGain: 1,
    effects: []
  },
  // For both augment windows `durationMultiplier` is the base window and
  // `durationPerTier` the longer one granted while the matching sphere is still active.
  {
    id: CATALYST_BALANCE_PROFILE_IDS.relentlessFire,
    parentId: ID.RELENTLESS_FIRE,
    name: 'Relentless Fire - Damage Window',
    profileKind: 'skill-variant',
    durationMultiplier: 5,
    durationPerTier: 8,
    effects: []
  },
  {
    id: CATALYST_BALANCE_PROFILE_IDS.shatteringIce,
    parentId: ID.SHATTERING_ICE,
    name: 'Shattering Ice - Triggered Packet',
    profileKind: 'skill-variant',
    durationMultiplier: 5,
    durationPerTier: 8,
    internalCooldown: 1,
    effects: [
      { type: 'strike', coefficient: 0.6, hits: 1 },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 1 }
    ]
  },
  {
    id: CATALYST_BALANCE_PROFILE_IDS.elementalCelerity,
    parentId: ID.ELEMENTAL_CELERITY,
    name: 'Elemental Celerity - Sphere Boons',
    profileKind: 'skill-variant',
    effects: [
      boon('Fire', 'might', 5, 6),
      boon('Water', 'vigor', 1, 6),
      boon('Air', 'fury', 1, 6),
      boon('Earth', 'protection', 1, 4)
    ]
  },
  trait(CATALYST_BALANCE_PROFILE_IDS.depthOfElements, 'Depth of Elements', {
    maximumStacks: 30
  }),
  trait(CATALYST_BALANCE_PROFILE_IDS.viciousEmpowerment, 'Vicious Empowerment', {
    internalCooldown: 0.25,
    effects: [
      {
        type: 'buff',
        name: 'Empowerment',
        kind: 'elemental empowerment',
        stacks: 2,
        duration: 15
      },
      boon('Might', 'might', 2, 10)
    ]
  }),
  trait(CATALYST_BALANCE_PROFILE_IDS.energizedElements, 'Energized Elements', {
    resourceGain: 2,
    effects: [boon('Fury', 'fury', 1, 2)]
  }),
  // playerStacks is the permanent in-combat baseline; the three attribute fields feed
  // the empowerment attribute bonus (flat per-stack, or the Empowered Empowerment scaling).
  trait(CATALYST_BALANCE_PROFILE_IDS.elementalEmpowerment, 'Elemental Empowerment', {
    maximumStacks: 10,
    playerStacks: 3,
    durationMultiplier: 15,
    attributePerStack: 0.01,
    coefficientMultiplier: 0.015,
    attributeConversion: 0.2
  }),
  trait(CATALYST_BALANCE_PROFILE_IDS.empoweringAuras, 'Empowering Auras', {
    maximumStacks: 5,
    durationMultiplier: 10,
    damageIncreasePerStack: 0.01
  }),
  trait(CATALYST_BALANCE_PROFILE_IDS.spectacularSphere, 'Spectacular Sphere', {
    effects: [
      boon('Quickness', 'quickness', 1, 2),
      boon('Fire', 'might', 5, 10),
      boon('Water', 'vigor', 1, 5),
      boon('Air', 'fury', 1, 5),
      boon('Earth', 'aegis', 1, 3)
    ]
  }),
  trait(CATALYST_BALANCE_PROFILE_IDS.elementalEpitome, 'Elemental Epitome', {
    internalCooldown: 10,
    effects: [
      aura('Fire', 'Fire Aura', 4),
      aura('Water', 'Frost Aura', 4),
      aura('Air', 'Shocking Aura', 3),
      aura('Earth', 'Magnetic Aura', 3),
      {
        type: 'buff',
        name: 'Empowerment',
        kind: 'elemental empowerment',
        stacks: 1,
        duration: 15
      }
    ]
  }),
  trait(CATALYST_BALANCE_PROFILE_IDS.elementalSynergy, 'Elemental Synergy', {
    internalCooldown: 10,
    resourceGain: 50,
    effects: [boon('Fire', 'might', 6, 10), boon('Earth', 'stability', 2, 6)]
  }),
  trait(CATALYST_BALANCE_PROFILE_IDS.sphereSpecialist, 'Sphere Specialist', {
    durationMultiplier: 1.5
  })
]);
