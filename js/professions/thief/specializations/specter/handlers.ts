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
import {
  completeShadowShroudSkill,
  handleDarkSentry,
  handleLarcenousTorment,
  observeSpecterEvent,
} from "./traits.js";

function augmentAfter(handler: SkillHandlerPhase<ThiefCastContext>) {
  return augmentSkillHandler(null, { afterEffects: handler });
}

export const specterSkillHandlers = Object.freeze({
  "thief.siphon": augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeSiphon,
  }),
  "thief.shadow-shroud-enter": augmentAfter(enterShadowShroud),
  "thief.shadow-shroud-exit": augmentAfter(exitShadowShroud),
  "thief.shadow-shroud-skill": augmentAfter(completeShadowShroudSkill),
});

export const specterSchedulerHooks = Object.freeze({
  advance: advanceSpecterResources,
  onCastStart: spendSpecterResources,
  onEventScheduled: {
    id: "thief.specter-events",
    order: 30,
    handler: observeSpecterEvent,
  },
  taskHandlers: Object.freeze({
    "thief.larcenous-torment": handleLarcenousTorment,
    "thief.specter-dark-sentry": handleDarkSentry,
  }),
});
