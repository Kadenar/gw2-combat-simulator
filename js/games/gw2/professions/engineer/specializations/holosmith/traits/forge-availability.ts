import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import type { EngineerRuntime } from '#gw2/professions/engineer/types.js';

const HOLOSMITH_STORM_AUTOATTACK_SKILL_IDS = new Set<number>([
  ID.LIGHT_STRIKE_STORM,
  ID.BRIGHT_SLASH_STORM,
  ID.FLASH_CUTTER_STORM
]);

/** Storm replacement runs before ordinary Forge availability so denial precedence stays stable. */
export function crystalStormAvailability(
  context: EngineerRuntime<HolosmithSkill>,
  skill: HolosmithSkill
): AvailabilityResult {
  if (skill.forgeSkill && skill.slot === 'Weapon_1') {
    const stormSelected = hasTrait(context.traits, TRAIT.CRYSTAL_CONFIGURATION_STORM);
    const stormSkill = HOLOSMITH_STORM_AUTOATTACK_SKILL_IDS.has(Number(skill.id));
    if (stormSelected !== stormSkill) {
      return denyEngineerCast(
        skill,
        'engineer.forge-auto-replaced',
        stormSelected ? 'Crystal Configuration: Storm replaces this attack.' : 'requires Crystal Configuration: Storm.'
      );
    }
  }

  return { ready: true };
}
