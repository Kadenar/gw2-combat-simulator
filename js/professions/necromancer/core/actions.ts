import { professionCoreState } from '../../../platform/engine/profession/state.js';
/**
 * Core (profession-agnostic) necromancer skill handlers.
 *
 * Covers Core flip-skill arming and expiry (`availableFlips`). Exposed as the
 * `necromancerCoreSkillHandlers` map.
 */
import { NECROMANCER_SKILL_IDS as ID } from '../data/ids.js';
import { emitState } from './shared.js';
import type { NecromancerCastContext, NecromancerSkill } from '../types.js';

function flip(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const state = professionCoreState(context);
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

  if (skill.flipParentId != null) {
    delete state.availableFlips[skill.id];
  }

  emitState(context, context.effectiveEnd, 'flip');
  return false;
}

export const necromancerCoreSkillHandlers = Object.freeze({
  'necromancer.flip': flip
});
