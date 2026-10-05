import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

// Stable IDs connect mech inheritance, attack damage, signet rules, and
// trait handlers to values that balance overrides can replace independently.
export const MECHANIST_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'engineer.mechanist.mech',
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
  {
    id: MECHANIST_BALANCE_PROFILE_IDS.forceSignet,
    name: 'Force Signet',
    profileKind: 'skill-variant',
    damageIncrease: 0.15,
    activeDamageIncrease: 0.18,
    effects: []
  },
  {
    rechargeMultiplier: 0.8,
    id: MECHANIST_BALANCE_PROFILE_IDS.overclock,
    name: 'Overclock Signet Passive',
    profileKind: 'skill-variant',
    parentId: ID.OVERCLOCK_SIGNET,
    effects: []
  }
]);
