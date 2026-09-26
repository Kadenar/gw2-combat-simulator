import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import { denySkillCast as denyEngineerCast } from '#gw2/professions/shared/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Enforces Mechanist's tool-belt replacement and trait-selected commands before casting. */
export function mechanistCastAvailability(context: EngineerRuntime, skill: EngineerSkill): AvailabilityResult {
  if (context.config.specialization !== 'Mechanist') return { ready: true };
  const state = mechanistState.from(context);
  if (skill.toolbeltParentName) {
    return denyEngineerCast(skill, 'engineer.toolbelt-replaced', 'Mechanist mech commands replace tool-belt skills.');
  }

  if (skill.mechanicSlot) {
    // Slots 1-3 are the three mech commands chosen by traits.
    const slot = Number(skill.mechanicSlot);
    if (slot <= 3 && !state.mech.commandSkillIds.includes(skill.id)) {
      return denyEngineerCast(
        skill,
        'engineer.mech-command',
        'a selected Mechanist trait supplies a different command.'
      );
    }
  }

  return { ready: true };
}
