import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const HERALD_SPIRIT_BOON_PROFILE_ID = 'revenant.spirit-boon.dragon';

export const HERALD_ELEVATED_COMPASSION_PROFILE_ID = 'revenant.elevated-compassion';

export const HERALD_SHARED_EMPOWERMENT_PROFILE_ID = 'revenant.shared-empowerment';

export const HERALD_DRACONIC_ECHO_PROFILE_ID = 'revenant.draconic-echo';

export const HERALD_NATURE_ASSASSIN_PROFILE_ID = 'revenant.nature-assassin';

export const HERALD_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: HERALD_NATURE_ASSASSIN_PROFILE_ID,
    name: 'Facet of Nature — Assassin',
    profileKind: 'mechanic',
    cooldown: 0.52,
    effects: [
      {
        name: 'Life Siphon',
        type: 'strike',
        coefficient: 0,
        damageKind: 'life-steal',
        flatStrikeBase: 53,
        flatStrikePowerCoeff: 0.0666,
        actorType: 'effect'
      }
    ]
  }
]);
