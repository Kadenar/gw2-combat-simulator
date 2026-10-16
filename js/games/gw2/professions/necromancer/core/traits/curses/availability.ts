import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import {
  NECROMANCER_SKILL_IDS as DAMAGE_SKILL,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Resolves the scepter trait replacement before other Core availability gates. */
export function lingeringCurseAvailability(
  runtime: MechanicQueriesOf<NecromancerRuntime>,
  skill: NecromancerSkill
): AvailabilityResult | undefined {
  if (skill.id === DAMAGE_SKILL.DEVOURING_DARKNESS && !hasTrait(runtime, TRAIT.LINGERING_CURSE))
    return denySkillCast(skill, 'necromancer.trait-locked', 'requires Lingering Curse.');

  if (skill.id === DAMAGE_SKILL.FEAST_OF_CORRUPTION && hasTrait(runtime, TRAIT.LINGERING_CURSE))
    return denySkillCast(
      skill,
      'necromancer.trait-replacement',
      'Devouring Darkness replaces it while Lingering Curse is selected.'
    );

  return undefined;
}
