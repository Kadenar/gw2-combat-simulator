/**
 * Owns Engineer palette-flip state transitions shared by Core and elite-specialization skills.
 * Skill declarations own flip metadata; the Core execution registry owns handler registration.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/state.js';
import type { EngineerCastContext, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Makes an explicitly declared palette follow-up available after its parent cast completes. */
function armFlip(context: EngineerCastContext, skill: EngineerSkill): void {
  // Raw API flips also describe chains; require an authored, consumable palette follow-up.
  const flip = skill.paletteFlipSkillId == null ? undefined : context.catalog.skillsById.get(skill.paletteFlipSkillId);
  if (!flip || flip.handlerId !== 'engineer.consume-flip') {
    throw new TypeError(`Engineer skill ${skill.name} requires a paletteFlipSkillId referencing a consumable flip.`);
  }

  professionCoreState(context).availableFlips[flip.id] = true;
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
