import { specterState } from '#gw2/content/professions/thief/specializations/specter/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import { denySkillCast as deny } from '#gw2/content/professions/lib/availability.js';
import type { AvailabilityResult } from '#gw2/platform/engine/types.js';
import type { ThiefPrecastContext, ThiefSkill } from '#gw2/content/professions/thief/types.js';

export function specterCastAvailability(context: ThiefPrecastContext, skill: ThiefSkill): AvailabilityResult {
  const state = specterState.from(context);
  if (skill.id === ID.ENTER_SHADOW_SHROUD) {
    if (state.shadowShroudActive) {
      return deny(skill, 'thief.in-shroud', 'Shadow Shroud is already active.');
    }

    if (state.shadowForce <= 0) {
      return deny(skill, 'thief.shadow-force', 'requires shadow force.');
    }
  }

  if (skill.id === ID.EXIT_SHADOW_SHROUD && !state.shadowShroudActive) {
    return deny(skill, 'thief.not-in-shroud', 'Shadow Shroud is not active.');
  }

  if (skill.shadowShroudSkill && !state.shadowShroudActive) {
    return deny(skill, 'thief.not-in-shroud', 'enter Shadow Shroud first.');
  }

  // While in shroud, only Shadow Shroud skills are castable; all other weapon/slot skills are locked out.
  // Profession skills (e.g. Siphon, Enter/Exit Shroud) are excluded from this guard via the first two checks above.
  if (
    state.shadowShroudActive &&
    !skill.shadowShroudSkill &&
    (skill.type === 'Weapon' || ['Heal', 'Utility', 'Elite'].includes(skill.type || ''))
  ) {
    return deny(skill, 'thief.in-shroud', 'the Shadow Shroud bar replaces weapons and slot skills.');
  }

  return { ready: true };
}
