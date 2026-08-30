import { augmentSkillHandler } from '../../../../../../platform/engine/skills/handlers.js';
import { emitStealTraitEffects } from '../../../core/traits/index.js';
import { completeSiphon, enterShadowShroud, exitShadowShroud } from '../mechanics/shadow-shroud.js';
import type { SkillHandlerPhase } from '../../../../../../platform/engine/types.js';
import type { ThiefCastContext } from '../../../types.js';
import { completeShadowShroudSkill } from '../traits/index.js';

function augmentAfter(handler: SkillHandlerPhase<ThiefCastContext>) {
  return augmentSkillHandler(null, { afterEffects: handler });
}

export const specterSkillHandlers = Object.freeze({
  'thief.siphon': augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeSiphon
  }),
  'thief.shadow-shroud-enter': augmentAfter(enterShadowShroud),
  'thief.shadow-shroud-exit': augmentAfter(exitShadowShroud),
  'thief.shadow-shroud-skill': augmentAfter(completeShadowShroudSkill)
});
