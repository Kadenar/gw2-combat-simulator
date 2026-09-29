import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';

export const BERSERKER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.berserker.resources',
  rageExtensions: 'warrior.berserker.rage-extensions'
});

export const BERSERKER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: BERSERKER_BALANCE_PROFILE_IDS.resources,
    name: 'Berserk Mode',
    profileKind: 'mechanic',
    maximumStacks: 10,
    attributeBonus: 300,
    attributePerStack: 150,
    effects: [{ name: 'berserk', type: 'buff', kind: 'berserk', stacks: 1, duration: 20 }]
  },
  {
    id: BERSERKER_BALANCE_PROFILE_IDS.rageExtensions,
    name: 'Berserk Rage Extensions',
    profileKind: 'mechanic',
    minimumStacks: 2,
    threshold: 3,
    maximumStacks: 5,
    effects: []
  }
]);
