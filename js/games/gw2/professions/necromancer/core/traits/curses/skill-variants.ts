import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Select Curses skill replacements and added self-conditions before shared skill execution. */

/** Resolves the scepter trait replacement before other Core availability gates. */
export function lingeringCurseAvailability(runtime: MechanicQueriesOf<NecromancerRuntime>, skill: NecromancerSkill) {
  if (skill.id === ID.DEVOURING_DARKNESS && !hasTrait(runtime, TRAIT.LINGERING_CURSE))
    return denySkillCast(skill, 'necromancer.trait-locked', 'requires Lingering Curse.');
  if (skill.id === ID.FEAST_OF_CORRUPTION && hasTrait(runtime, TRAIT.LINGERING_CURSE))
    return denySkillCast(
      skill,
      'necromancer.trait-replacement',
      'Devouring Darkness replaces it while Lingering Curse is selected.'
    );
  return undefined;
}
