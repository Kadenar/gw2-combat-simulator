import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

// Stable IDs connect mech inheritance, attack damage, signet rules, and
// trait handlers to values that balance overrides can replace independently.
export const MECHANIST_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'engineer.mechanist.mech',
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
    criticalChance: 0.05,
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
  trait(MECHANIST_BALANCE_PROFILE_IDS.jadeCannons, 'Jade Cannons', {
    criticalChance: 0.2,
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 6 }]
  }),
  trait(MECHANIST_BALANCE_PROFILE_IDS.rocketPunch, 'Rocket Punch', {
    internalCooldown: 5,
    effects: []
  }),
  // Trait tuning is shared by build calculations, combat, and tooltips.
  trait(TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS, 'Mech Arms: High-Impact Drivers', {
    internalCooldown: 1,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 1, duration: 10, packetLabel: 'on qualifying mech strikes' }
    ]
  }),
  trait(TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS, 'Mech Arms: Single-Edge Cutters', {
    internalCooldown: 1,
    effects: [
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3, actorType: 'summon' }
    ]
  }),
  trait(MECHANIST_BALANCE_PROFILE_IDS.jadeDynamo, 'Jade Dynamo', {
    rechargeMultiplier: 0.8,
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 2.5 }]
  }),
  {
    id: MECHANIST_BALANCE_PROFILE_IDS.forceSignet,
    name: 'Force Signet',
    profileKind: 'skill-variant',
    damageIncrease: 0.15,
    activeDamageIncrease: 0.18,
    effects: []
  },
  // J-Drive improves the selected Overclock passive and keeps it active while recharging.
  trait(TRAIT.MECH_CORE_J_DRIVE, 'Mech Core: J-Drive', { rechargeMultiplier: 0.76, effects: [] }),
  {
    rechargeMultiplier: 0.8,
    id: MECHANIST_BALANCE_PROFILE_IDS.overclock,
    name: 'Overclock Signet Passive',
    profileKind: 'skill-variant',
    parentId: ID.OVERCLOCK_SIGNET,
    effects: []
  }
]);
