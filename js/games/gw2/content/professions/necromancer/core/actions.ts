import { emitStateSnapshot } from '../../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { snapshotNecromancerState } from '../state/index.js';
/**
 * Core (profession-agnostic) necromancer skill handlers.
 *
 * Covers Core flip-skill arming and expiry (`availableFlips`). Exposed as the
 * `necromancerCoreSkillHandlers` map.
 */
import { NECROMANCER_SKILL_IDS as ID } from '../data/ids.js';
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

  emitStateSnapshot(
    context,
    'necromancer',
    context.effectiveEnd,
    'flip',
    snapshotNecromancerState(context.state.profession),
    { dedupeAcrossSourceIds: true }
  );
  return false;
}

export const necromancerCoreSkillHandlers = Object.freeze({
  'necromancer.flip': flip
});
