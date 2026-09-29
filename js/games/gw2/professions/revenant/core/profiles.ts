import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';

export const REVENANT_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'revenant.core.resources',
  battleScars: 'revenant.core.battle-scars'
});

export const REVENANT_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Revenant Resources',
    profileKind: 'mechanic',
    energyRegenerationPerSecond: 5,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5,
    effects: []
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars,
    name: 'Battle Scars',
    profileKind: 'mechanic',
    maximumStacks: 25,
    effects: [
      {
        name: 'battle-scars',
        type: 'buff',
        kind: 'battle-scars',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        damageKind: 'life-steal',
        flatStrikeBase: 117,
        flatStrikePowerCoeff: 0.006,
        name: 'Battle Scars — Life Siphon',
        actorType: 'effect'
      }
    ]
  }
] satisfies readonly BalanceProfile[]);
