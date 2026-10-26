import type { BalanceProfile } from '#gw2/platform/skills/types.js';

// Actor base stats remain separate from Mechanical Genius inheritance and skill-owned signet passives.
export const MECHANIST_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'engineer.mechanist.mech'
});

export const MECHANIST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: MECHANIST_BALANCE_PROFILE_IDS.resources,
    name: 'Jade Mech Base Attributes',
    profileKind: 'mechanic',
    criticalChance: 0.05,
    baseAttribute: 1000,
    basePrecision: 1,
    effects: []
  }
]);
