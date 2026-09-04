/** Registers scheduler-phase skill activations for this module. */
import { augmentSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { emitStealTraitEffects } from '#gw2/professions/thief/core/traits/index.js';
import {
  completeSiphon,
  enterShadowShroud,
  exitShadowShroud
} from '#gw2/professions/thief/specializations/specter/mechanics/shadow-shroud.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/execution/types.js';
import type { ThiefCastContext } from '#gw2/professions/thief/types.js';
import { completeShadowShroudSkill } from '#gw2/professions/thief/specializations/specter/traits/index.js';

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
