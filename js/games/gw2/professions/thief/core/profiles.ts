import type { BalanceProfile } from '#gw2/platform/skills/types.js';

/** Core initiative capacity and recovery are shared across weapon and slot skills. */
export const THIEF_CORE_BALANCE_PROFILE_IDS = Object.freeze({ resources: 'thief.core.resources' });

export const THIEF_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Thief Core Resources',
    profileKind: 'mechanic',
    maximumStacks: 12,
    resourceGain: 1,
    effects: []
  }
]);
