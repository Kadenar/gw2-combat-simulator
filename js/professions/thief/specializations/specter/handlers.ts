import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";
import { emitStealTraitEffects } from "../../core/steal.js";
import {
  advanceSpecterResources,
  completeSiphon,
  enterShadowShroud,
  exitShadowShroud,
  spendSpecterResources,
} from "./shroud.js";
import type { SkillHandlerPhase } from "../../../../platform/engine/types.js";
import type { ThiefCastContext } from "../../types.js";

function augmentAfter(handler: SkillHandlerPhase<ThiefCastContext>) {
  return augmentSkillHandler(null, { afterEffects: handler });
}

export const specterSkillHandlers = Object.freeze({
  "thief.siphon": augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeSiphon,
  }),
  "thief.shadow-shroud-enter": augmentAfter(enterShadowShroud),
  "thief.shadow-shroud-exit": augmentAfter(exitShadowShroud),
});

export const specterSchedulerHooks = Object.freeze({
  advance: advanceSpecterResources,
  onCastStart: spendSpecterResources,
});
