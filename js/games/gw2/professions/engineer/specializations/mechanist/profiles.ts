import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

// Stable IDs connect mech inheritance, attack damage, signet rules, and
// trait handlers to values that balance overrides can replace independently.
export const MECHANIST_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'engineer.mechanist.mech',
  meleeChain: 'engineer.mechanist.melee-chain',
  jadeCannons: TRAIT.MECH_ARMS_JADE_CANNONS,
  rocketPunch: TRAIT.MECH_FIGHTER,
  jadeDynamo: TRAIT.MECH_CORE_JADE_DYNAMO,
  forceSignet: 'engineer.mechanist.force-signet',
  overclock: ID.OVERCLOCK_SIGNET
});

// Supply standard trait metadata once; callers add only the values and effects
// read by the Mechanist runtime.

// Balance profiles own damage and trait tuning; execution timing lives in mechanics/constants.ts.
export const MECHANIST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: MECHANIST_BALANCE_PROFILE_IDS.resources,
    name: 'Jade Mech Attribute Inheritance',
    profileKind: 'mechanic',
    baseAttribute: 1000,
    inheritanceRatio: 0.5,
    secondaryAttributeCap: 750,
    powerCap: 2250,
    improvedSecondaryAttributeCap: 1500,
    precisionCap: 2500,
    improvedInheritanceRatio: 1,
    basePrecision: 1,
    effects: []
  },
  {
    id: MECHANIST_BALANCE_PROFILE_IDS.meleeChain,
    name: 'Jade Mech Melee Chain',
    profileKind: 'skill-variant',
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 2,
        atMs: 0
      }
    ]
  },
  trait(MECHANIST_BALANCE_PROFILE_IDS.jadeCannons, 'Jade Cannons', {
    criticalChance: 0.2,
    effects: [{ type: 'strike', coefficient: 0.42, hits: 1 }]
  }),
  trait(MECHANIST_BALANCE_PROFILE_IDS.rocketPunch, 'Rocket Punch', {
    internalCooldown: 5,
    effects: [
      { type: 'strike', coefficient: 1, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 5 },
      { type: 'control', duration: 100 }
    ]
  }),
  trait(MECHANIST_BALANCE_PROFILE_IDS.jadeDynamo, 'Jade Dynamo', {
    rechargeMultiplier: 0.8,
    effects: [{ type: 'boon', boon: 'quickness', stacks: 1, duration: 2.5 }]
  }),
  {
    id: MECHANIST_BALANCE_PROFILE_IDS.forceSignet,
    name: 'Force Signet',
    profileKind: 'skill-variant',
    damageIncrease: 0.15,
    activeDamageIncrease: 0.18,
    effects: []
  },
  {
    id: MECHANIST_BALANCE_PROFILE_IDS.overclock,
    name: 'Jade Buster Cannon',
    profileKind: 'skill-variant',
    parentId: ID.OVERCLOCK_SIGNET,
    packetCount: 5,
    effects: [
      { type: 'strike', coefficient: 0.95, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 6 }
    ]
  }
]);
