import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/content/professions/necromancer/state.js';
/**
 * Core (profession-agnostic) necromancer skill handlers.
 *
 * Covers Core flip-skill arming and expiry (`availableFlips`). Exposed as the
 * `necromancerCoreSkillHandlers` map.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/content/professions/necromancer/types.js';

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
export const necromancerCoreSkillHandlers = Object.freeze({
  'necromancer.flip': flip
});
