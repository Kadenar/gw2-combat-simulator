import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { ANTIQUARY_THIEVES_GUILD_PROFILE } from '#gw2/professions/thief/specializations/antiquary/mechanics/thieves-guild.js';

/** Shared identity lifetime applies across artifacts; counts and exceptional windows belong to skills. */
export const ANTIQUARY_BALANCE_PROFILE_IDS = Object.freeze({ artifactWindows: 'thief.antiquary.artifact-windows' });

export const ANTIQUARY_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  ANTIQUARY_THIEVES_GUILD_PROFILE,
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.artifactWindows,
    name: 'Antiquary Artifact Windows',
    profileKind: 'mechanic',
    duration: 10,
    effects: []
  }
]);
