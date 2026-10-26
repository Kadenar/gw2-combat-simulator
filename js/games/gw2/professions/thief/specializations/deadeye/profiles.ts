import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { DEADEYE_THIEVES_GUILD_PROFILE } from '#gw2/professions/thief/specializations/deadeye/mechanics/thieves-guild.js';

/** Shared guild actor policy remains separate from individual skill payloads. */
export const DEADEYE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([DEADEYE_THIEVES_GUILD_PROFILE]);
