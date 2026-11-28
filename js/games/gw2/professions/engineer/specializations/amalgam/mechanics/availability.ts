import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { AmalgamSkill } from '#gw2/professions/engineer/specializations/amalgam/types.js';
import type { EngineerRuntime } from '#gw2/professions/engineer/types.js';

/** The selected Amalgam module rejects unequipped morphs; Double Helix's `modifySkillId` hook selects Evolve earlier. */
export function amalgamCastAvailability(
  context: MechanicQueriesOf<EngineerRuntime>,
  skill: AmalgamSkill
): AvailabilityResult {
  const state = amalgamState.from(context.profession);

  // A rotation can cast a protocol in any equipped slot.
  if (skill.morphKind != null && !state.selectedMorphSkillIds.includes(Number(skill.id))) {
    return denyEngineerCast(skill, 'engineer.morph-selection', 'this protocol is not equipped.');
  }

  return { ready: true };
}
