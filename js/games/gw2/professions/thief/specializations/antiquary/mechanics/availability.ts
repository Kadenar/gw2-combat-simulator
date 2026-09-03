import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { denySkillCast as deny } from '#gw2/professions/lib/availability.js';
import type { AvailabilityResult } from '#gw2/platform/engine/types.js';
import type { ThiefPrecastContext, ThiefSkill } from '#gw2/professions/thief/types.js';

export function antiquaryCastAvailability(context: ThiefPrecastContext, skill: ThiefSkill): AvailabilityResult {
  const state = antiquaryState.from(context);
  if (skill.artifactKind) {
    if (state.artifactUsesRemaining <= 0 || !state.artifactSlots.some((slot) => slot.skillId === skill.id)) {
      // if a Skritt scuffle is in progress, hint the scheduler to retry after the next periodic pilfer rather than looping immediately
      const retryAt =
        Number(state.nextSkrittScufflePilferAt || 0) > context.start ? Number(state.nextSkrittScufflePilferAt) : null;
      return deny(skill, 'thief.artifact', 'this artifact is not in an available artifact slot.', retryAt);
    }
  }

  // backfire variants (e.g. Stone Summit Misfire) are not player-selectable; they are emitted internally by resolveDoubleEdge
  if (skill.backfire) {
    return deny(skill, 'thief.backfire-variant', 'backfire variants are resolved by their Double Edge skill.');
  }

  // Reshuffle requires an active artifact pool to reroll; it cannot create a pool from nothing
  if (skill.id === ID.RESHUFFLE && (state.artifactUsesRemaining <= 0 || state.artifactSlots.length === 0)) {
    return deny(skill, 'thief.artifact', 'pilfer artifacts first.');
  }

  return { ready: true };
}
