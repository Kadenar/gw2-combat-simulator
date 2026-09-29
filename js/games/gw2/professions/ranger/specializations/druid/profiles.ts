import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';

export const DRUID_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'ranger.druid.resources'
});

export const DRUID_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: DRUID_BALANCE_PROFILE_IDS.resources,
    name: 'Celestial Avatar and Astral Force',
    profileKind: 'mechanic',
    maximumStacks: 100,
    durationMultiplier: 15,
    astralForceRetentionMultiplier: 0.5,
    resourceGain: 0.75,
    coefficientMultiplier: 2,
    effects: []
  }
]);
