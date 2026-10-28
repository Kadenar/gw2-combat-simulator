import type { ThiefGuildContribution } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { createThievesGuildHooks } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { ANTIQUARY_THIEVES_GUILD_ACTOR } from '#gw2/professions/thief/specializations/antiquary/mechanics/thieves-guild.js';
import { DAREDEVIL_THIEVES_GUILD_ACTOR } from '#gw2/professions/thief/specializations/daredevil/mechanics/thieves-guild.js';
import { DEADEYE_THIEVES_GUILD_ACTOR } from '#gw2/professions/thief/specializations/deadeye/mechanics/thieves-guild.js';
import {
  guildAttackConditions,
  SPECTER_THIEVES_GUILD_ACTOR
} from '#gw2/professions/thief/specializations/specter/mechanics/thieves-guild.js';

const guildContributions: Readonly<Record<string, ThiefGuildContribution | null>> = Object.freeze({
  Core: null,
  Antiquary: { actor: ANTIQUARY_THIEVES_GUILD_ACTOR },
  Daredevil: { actor: DAREDEVIL_THIEVES_GUILD_ACTOR },
  Deadeye: { actor: DEADEYE_THIEVES_GUILD_ACTOR },
  Specter: { actor: SPECTER_THIEVES_GUILD_ACTOR, conditions: guildAttackConditions }
});

/** Select once at the family boundary; Core receives no inactive policies or static summon definitions. */
export function thiefFamilyRuntimeHooks(specialization: string) {
  const contribution = guildContributions[specialization];

  if (contribution === undefined) throw new Error(`Unknown Thief guild specialization: ${specialization}`);

  return createThievesGuildHooks(contribution);
}
