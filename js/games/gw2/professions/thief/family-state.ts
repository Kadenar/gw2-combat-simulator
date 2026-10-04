import type { ThiefGuildContribution } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { createThievesGuildHooks } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { ANTIQUARY_THIEVES_GUILD_PROFILE } from '#gw2/professions/thief/specializations/antiquary/mechanics/thieves-guild.js';
import { DAREDEVIL_THIEVES_GUILD_PROFILE } from '#gw2/professions/thief/specializations/daredevil/mechanics/thieves-guild.js';
import { DEADEYE_THIEVES_GUILD_PROFILE } from '#gw2/professions/thief/specializations/deadeye/mechanics/thieves-guild.js';
import {
  SPECTER_THIEVES_GUILD_PROFILE,
  guildAttackConditions
} from '#gw2/professions/thief/specializations/specter/mechanics/thieves-guild.js';

const guildContributions: Readonly<Record<string, ThiefGuildContribution | null>> = Object.freeze({
  Core: null,
  Antiquary: { profileId: ANTIQUARY_THIEVES_GUILD_PROFILE.id },
  Daredevil: { profileId: DAREDEVIL_THIEVES_GUILD_PROFILE.id },
  Deadeye: { profileId: DEADEYE_THIEVES_GUILD_PROFILE.id },
  Specter: { profileId: SPECTER_THIEVES_GUILD_PROFILE.id, conditions: guildAttackConditions }
});

/** Select once at the family boundary; Core receives no inactive policies or static summon definitions. */
export function thiefFamilyRuntimeHooks(specialization: string) {
  const contribution = guildContributions[specialization];
  if (contribution === undefined) throw new Error(`Unknown Thief guild specialization: ${specialization}`);
  return createThievesGuildHooks(contribution);
}
