import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const REAPER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'necromancer.reaper.resources'
});

export const REAPER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: REAPER_BALANCE_PROFILE_IDS.resources,
    name: 'Reaper Shroud',
    profileKind: 'mechanic',
    lifeForceDrain: 4,
    effects: []
  }
]);
