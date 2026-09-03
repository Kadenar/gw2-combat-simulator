import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { denySkillCast as denyEngineerCast } from '#gw2/professions/lib/availability.js';
import type { AvailabilityResult } from '#gw2/platform/engine/types.js';
import type { EngineerPrecastContext, EngineerSkill } from '#gw2/professions/engineer/types.js';

const RECALL_MECH_SKILL_IDS = new Set([ID.RECALL_MECH, ID.RECALL_MECH_ID_63300]);

/** Enforces Mechanist's tool-belt replacement, selected commands, and mech summon state before casting. */
export function mechanistCastAvailability(context: EngineerPrecastContext, skill: EngineerSkill): AvailabilityResult {
  if (context.config.specialization !== 'Mechanist') return { ready: true };
  const state = mechanistState.from(context);
  if (skill.toolbeltParentName) {
    return denyEngineerCast(skill, 'engineer.toolbelt-replaced', 'Mechanist mech commands replace tool-belt skills.');
  }

  if (skill.mechanicSlot) {
    // Slots 1-3 are the three mech commands chosen by traits.
    // Slot 4 is Crash Down / Recall Mech (the mech toggle) — not a command.
    const slot = Number(skill.mechanicSlot);
    if (slot <= 3 && !state.mech.commandSkillIds.includes(skill.id)) {
      return denyEngineerCast(
        skill,
        'engineer.mech-command',
        'a selected Mechanist trait supplies a different command.'
      );
    }

    if (slot <= 3 && !state.mech.active) {
      return denyEngineerCast(skill, 'engineer.mech-inactive', 'summon the jade mech first.');
    }

    if (skill.id === ID.CRASH_DOWN && state.mech.active) {
      return denyEngineerCast(skill, 'engineer.mech-active', 'the jade mech is already active.');
    }

    if (RECALL_MECH_SKILL_IDS.has(Number(skill.id)) && !state.mech.active) {
      return denyEngineerCast(skill, 'engineer.mech-inactive', 'the jade mech is not active.');
    }
  }

  return { ready: true };
}
