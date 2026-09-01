import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitEngineerStateSnapshot } from '#gw2/content/professions/engineer/state.js';
import type { EngineerCastContext, EngineerSkill } from '#gw2/content/professions/engineer/types.js';

/** Makes an explicitly declared palette follow-up available after its parent cast completes. */
function armFlip(context: EngineerCastContext, skill: EngineerSkill): void {
  // paletteFlipSkillId explicitly declares a palette flip; flipSkillId is the raw API
  // field which conflates palette flips with chain skills. Fall back to flipSkillId
  // only for skills not yet annotated with an explicit paletteFlipSkillId.
  const flipSkillId = Number(skill.paletteFlipSkillId ?? skill.flipSkillId);
  if (!Number.isFinite(flipSkillId)) return;
  professionCoreState(context).availableFlips[flipSkillId] = true;
  // effectiveEnd: flip becomes available after the cast completes, not when it starts
  emitEngineerStateSnapshot(context, context.effectiveEnd, 'arm-flip');
}

/** Consumes a palette follow-up after its armed action is used. */
function consumeFlip(context: EngineerCastContext, skill: EngineerSkill): void {
  professionCoreState(context).availableFlips[skill.id] = false;
  emitEngineerStateSnapshot(context, context.effectiveEnd, 'consume-flip');
}

/** Routes palette-arm and palette-consume handlers to their state transitions. */
export const engineerFlipSkillHandlers = Object.freeze({
  'engineer.arm-flip': armFlip,
  'engineer.consume-flip': consumeFlip
});
