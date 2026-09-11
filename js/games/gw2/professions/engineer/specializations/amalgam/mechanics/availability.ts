import { amalgamState, resolveAmalgamSkillId } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { denySkillCast as denyEngineerCast } from '#gw2/professions/lib/availability.js';
import type { AvailabilityResult } from '#gw2/platform/engine/execution/types.js';
import type { EngineerPrecastContext, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Rejects Amalgam actions that do not match the selected protocols or Double Helix trait. */
export function amalgamCastAvailability(context: EngineerPrecastContext, skill: EngineerSkill): AvailabilityResult {
  if (context.config.specialization !== 'Amalgam') return { ready: true };
  // Direct availability queries must reject the inactive variant just as cast resolution selects the active one.
  if (resolveAmalgamSkillId(context.config, skill.id) !== skill.id) {
    return denyEngineerCast(skill, 'engineer.evolve-selection', 'another Evolve variant is selected by Double Helix.');
  }

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
