import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";
import { applyWarriorSkillResource } from "../../core/resources.js";
import { spellbreakerState } from "./state.js";
import type { WarriorCastContext, WarriorSkill } from "../../types.js";

function fullCounter(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  // +1 second extends the active window past the cast-end boundary so
  // availability checks at exactly effectiveEnd still see it as active.
  spellbreakerState.from(context).fullCounterActiveUntil =
    context.effectiveEnd + 1;
}

export const spellbreakerSkillHandlers = Object.freeze({
  "warrior.full-counter": augmentSkillHandler(fullCounter),
});
