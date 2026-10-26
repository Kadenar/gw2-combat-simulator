import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { SPECTER_THIEVES_GUILD_PROFILE } from '#gw2/professions/thief/specializations/specter/mechanics/thieves-guild.js';

/** Shared guild actor policy remains separate from individual skill payloads. */
export const SPECTER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([SPECTER_THIEVES_GUILD_PROFILE]);
