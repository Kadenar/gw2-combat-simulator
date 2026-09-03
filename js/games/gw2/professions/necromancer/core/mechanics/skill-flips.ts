/**
 * Owns Core Necromancer follow-up flip arming, consumption, and state publication.
 * The Core execution registry only assigns this persistent state behavior to scheduler phases.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/state.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

// Arms follow-up skills for their skill-specific window and clears them when the follow-up is consumed.
function flip(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const state = professionCoreState(context);
  // Arm the follow-up for the skill-specific duration measured from cast completion.
  if (skill.flipSkillId != null) {
    const duration =
      (
        {
          [ID.DARK_PATH]: 3,
          [ID.INFUSING_TERROR]: 6,
          [ID.RIPPLE_OF_HORROR]: 12
        } as Readonly<Record<string | number, number>>
      )[skill.id] || 5;
    state.availableFlips[skill.flipSkillId] = context.effectiveEnd + duration;
  }

  // Consuming a follow-up removes its own availability entry.
  if (skill.flipParentId != null) {
    delete state.availableFlips[skill.id];
  }

  // Publish the resulting flip state for observers at the same simulation timestamp.
  emitNecromancerStateSnapshot(context, context.effectiveEnd, 'flip', { dedupeAcrossSourceIds: true });
  return false;
}

/** Exposes Core Necromancer flip-state updates by scheduler handler ID. */
export const necromancerFlipSkillHandlers = Object.freeze({
  'necromancer.flip': flip
});
