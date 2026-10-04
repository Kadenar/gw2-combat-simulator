import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { resolveAmalgamSkillId } from '#gw2/professions/engineer/specializations/amalgam/traits/behavior.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Rejects Amalgam actions that do not match the selected protocols or Double Helix trait. */
export function amalgamCastAvailability(
  context: MechanicQueriesOf<EngineerRuntime>,
  skill: EngineerSkill
): AvailabilityResult {
  if (context.config.specialization !== 'Amalgam') return { ready: true };
  // Direct availability queries must reject the inactive variant just as cast resolution selects the active one.
  if (resolveAmalgamSkillId(hasTrait(context.traits, TRAIT.DOUBLE_HELIX), skill.id) !== skill.id) {
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
