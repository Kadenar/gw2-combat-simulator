import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const WARRIOR_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.core.resources',
  burstTiers: 'warrior.core.burst-tiers'
});

/** Shared adrenaline capacity and burst thresholds apply across native burst skills. */
export const WARRIOR_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Warrior Core Resources',
    profileKind: 'mechanic',
    maximumStacks: 30,
    effects: []
  },
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.burstTiers,
    name: 'Warrior Burst Tiers',
    profileKind: 'mechanic',
    threshold: 20,
    maximumStacks: 30,
    effects: []
  }
]);
