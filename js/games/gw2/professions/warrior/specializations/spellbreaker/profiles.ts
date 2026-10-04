import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const SPELLBREAKER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.spellbreaker.resources'
});

export const SPELLBREAKER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: SPELLBREAKER_BALANCE_PROFILE_IDS.resources,
    name: 'Spellbreaker Adrenaline',
    profileKind: 'mechanic',
    maximumStacks: 20,
    effects: []
  }
]);
