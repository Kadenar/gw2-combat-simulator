import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { DAREDEVIL_THIEVES_GUILD_PROFILE } from '#gw2/professions/thief/specializations/daredevil/mechanics/thieves-guild.js';

export const DAREDEVIL_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'thief.daredevil.resources',
  palmStrike: 'thief.daredevil.palm-strike'
});

export const DAREDEVIL_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  DAREDEVIL_THIEVES_GUILD_PROFILE,
  {
    id: DAREDEVIL_BALANCE_PROFILE_IDS.resources,
    name: 'Daredevil Endurance',
    profileKind: 'mechanic',
    maximumStacks: 150,
    effects: []
  },
  {
    id: DAREDEVIL_BALANCE_PROFILE_IDS.palmStrike,
    name: 'Palm Strike Window',
    profileKind: 'mechanic',
    durationMultiplier: 5,
    effects: []
  }
  // Trait tuning is shared by build calculations, combat, and tooltips.
]);
