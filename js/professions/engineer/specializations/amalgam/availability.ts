import { amalgamState } from './state.js';
import { denyEngineerCast } from '../../core/availability.js';
import type { AvailabilityResult } from '../../../../platform/engine/types.js';
import type { EngineerPrecastContext, EngineerSkill } from '../../types.js';

export function amalgamCastAvailability(context: EngineerPrecastContext, skill: EngineerSkill): AvailabilityResult {
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
