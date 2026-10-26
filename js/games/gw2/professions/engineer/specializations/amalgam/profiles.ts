import type { BalanceProfile } from '#gw2/platform/skills/types.js';

// Rapacious is shared proc state; strain attribute scaling is shared across protocol grants.
export const AMALGAM_BALANCE_PROFILE_IDS = Object.freeze({
  strains: 'engineer.amalgam.strains',
  rapaciousStrain: 'engineer.amalgam.rapacious-strain'
});

export const AMALGAM_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: 'engineer.amalgam.rapacious-strain',
    name: 'Rapacious Strain',
    profileKind: 'mechanic',
    duration: 8,
    internalCooldown: 0.48,
    effects: [
      {
        name: 'Rapacious Strain',
        type: 'strike',
        coefficient: 0.3,
        hits: 1
      }
    ]
  },
  {
    id: 'engineer.amalgam.strains',
    name: 'Amalgam Strains',
    profileKind: 'mechanic',
    attributePerStack: 5,
    effects: []
  }
]);
