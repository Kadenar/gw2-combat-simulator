import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { thiefAvailability } from '#gw2/professions/thief/core/mechanics/availability.js';
import type { BonusStealthAttackCharges } from '#gw2/professions/thief/core/mechanics/bonus-stealth-attacks.js';
import { beginThiefStealthAttack } from '#gw2/professions/thief/core/mechanics/stealth.js';
import type { ThiefGuildContribution } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { createThievesGuildHooks, guildRoster } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { ANTIQUARY_THIEVES_GUILD_ACTOR } from '#gw2/professions/thief/specializations/antiquary/mechanics/thieves-guild.js';
import { metalLegionGuitarCharges } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { DAREDEVIL_THIEVES_GUILD_ACTOR } from '#gw2/professions/thief/specializations/daredevil/mechanics/thieves-guild.js';
import { DEADEYE_THIEVES_GUILD_ACTOR } from '#gw2/professions/thief/specializations/deadeye/mechanics/thieves-guild.js';
import { silentScopeCharges } from '#gw2/professions/thief/specializations/deadeye/state.js';
import {
  guildAttackConditions,
  SPECTER_THIEVES_GUILD_ACTOR
} from '#gw2/professions/thief/specializations/specter/mechanics/thieves-guild.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

interface ThiefFamilyContribution {
  guild: ThiefGuildContribution | null;
  charges?: BonusStealthAttackCharges;
}

const contributions: Readonly<Record<string, ThiefFamilyContribution>> = Object.freeze({
  Core: { guild: null },
  Antiquary: { guild: { actor: ANTIQUARY_THIEVES_GUILD_ACTOR }, charges: metalLegionGuitarCharges },
  Daredevil: { guild: { actor: DAREDEVIL_THIEVES_GUILD_ACTOR } },
  Deadeye: { guild: { actor: DEADEYE_THIEVES_GUILD_ACTOR }, charges: silentScopeCharges },
  Specter: { guild: { actor: SPECTER_THIEVES_GUILD_ACTOR, conditions: guildAttackConditions } }
});

// Resolve a build's guild members without constructing a combat runtime.
export function thievesGuildRoster(specialization: string, skill: ThiefSkill) {
  return guildRoster(skill.summonAttack!.summons, contributions[specialization].guild?.actor);
}

/** Bind cast eligibility and spending to the same active elite for the lifetime of this runtime. */
export function thiefFamilyRuntimeHooks(specialization: string) {
  const contribution = contributions[specialization];

  if (contribution === undefined) throw new Error(`Unknown Thief specialization: ${specialization}`);

  return composeRuntimeHooks<ThiefRuntimeState, ThiefSkill>([
    createThievesGuildHooks(contribution.guild),
    {
      availability: (runtime, skill) => thiefAvailability(runtime, skill, contribution.charges),
      onCastStart(runtime, cast) {
        if (cast.skill.stealthAttack) beginThiefStealthAttack(runtime, cast, contribution.charges);
      }
    }
  ]);
}
