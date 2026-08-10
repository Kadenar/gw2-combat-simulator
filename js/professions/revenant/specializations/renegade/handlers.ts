import {
  augmentSkillHandler,
  SKILL_HANDLER_MODES,
} from "../../../../platform/engine/skill-handlers.js";
import type {
  Skill,
  SkillHandlerMode,
} from "../../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../../types.js";
import { handlerPhase, replaceAfter } from "../../core/handler-strategies.js";
import { revenantAssassinRenegadeSkillHandlers } from "./renegade.js";
import type { BandTogetherState } from "./renegade.js";

const bandTogether =
  revenantAssassinRenegadeSkillHandlers["revenant.band-together"];

function bandTogetherHandlerMode(
  context: RevenantCastContext,
  skill: Skill,
): SkillHandlerMode {
  return bandTogether.replacesEffects(context, skill)
    ? SKILL_HANDLER_MODES.REPLACE
    : SKILL_HANDLER_MODES.AUGMENT;
}

const handlers = Object.freeze({
  "revenant.heroic-command": replaceAfter(
    revenantAssassinRenegadeSkillHandlers["revenant.heroic-command"],
  ),
  "revenant.orders-from-above": replaceAfter(
    revenantAssassinRenegadeSkillHandlers["revenant.orders-from-above"],
  ),
  "revenant.band-together": augmentSkillHandler<RevenantCastContext>(
    handlerPhase(bandTogether.beforeEffects),
    {
      resolveMode: bandTogetherHandlerMode,
      afterEffect: (context, skill, event, state) =>
        bandTogether.afterEffect(
          context,
          skill as RevenantSkill,
          event as RevenantSimulationEvent,
          state as BandTogetherState,
        ),
      afterEffects: (context, skill, state) =>
        bandTogether.afterEffects(
          context,
          skill as RevenantSkill,
          state as BandTogetherState,
        ),
    },
  ),
});

export const renegadeSkillHandlers = new Map(Object.entries(handlers));
