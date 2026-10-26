import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { DAREDEVIL_THIEVES_GUILD_PROFILE } from '#gw2/professions/thief/specializations/daredevil/mechanics/thieves-guild.js';

/** Shared guild actor policy remains separate from individual skill payloads. */
export const DAREDEVIL_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([DAREDEVIL_THIEVES_GUILD_PROFILE]);
