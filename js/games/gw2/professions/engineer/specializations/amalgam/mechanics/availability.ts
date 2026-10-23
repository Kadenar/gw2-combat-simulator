import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Rejects Amalgam morphs outside the selected protocols; Double Helix's `modifySkillId` hook selects Evolve earlier. */
export function amalgamCastAvailability(
  context: MechanicQueriesOf<EngineerRuntime>,
  skill: EngineerSkill
): AvailabilityResult {
  if (context.config.specialization !== 'Amalgam') return { ready: true };

  const state = amalgamState.from(context);

  // Each protocol type (e.g., "Offensive Protocol: Shred") exists as several
  // distinct skill IDs depending on which mechanic slot it occupies. Block any
  // morph skill whose ID was not selected for its slot so rotations that
  // reference an unequipped protocol are rejected rather than silently cast.
  if (skill.categories?.includes('Morph') && !state.selectedMorphSkillIds.includes(Number(skill.id))) {
    return denyEngineerCast(skill, 'engineer.morph-selection', 'another morph is selected for this profession slot.');
  }

  return { ready: true };
}
