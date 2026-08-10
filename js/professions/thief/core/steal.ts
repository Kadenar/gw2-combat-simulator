import { professionCoreState } from "../../../platform/engine/profession.js";
import { THIEF_SKILL_IDS as ID } from "../data/ids.js";
import { emitThiefState } from "./shared.js";
import { applyStealCompletionTraits } from "./traits.js";
import type { SkillId } from "../../../platform/engine/types.js";
import type { ThiefCastContext } from "../types.js";

const STOLEN_ID_BY_CHOICE: Readonly<Record<string, number>> = Object.freeze({
  "throw-gunk": ID.THROW_GUNK,
  "consume-plasma": ID.CONSUME_PLASMA,
  "whirling-axe": ID.WHIRLING_AXE,
});
function selectedStolenSkill(context: ThiefCastContext): SkillId {
  const choice =
    context.config.deterministicChoices?.stolenSkillChoice || "throw-gunk";
  return STOLEN_ID_BY_CHOICE[choice] || ID.THROW_GUNK;
}

export function completeStealWithStoredSkill(
  context: ThiefCastContext,
  storedSkillId: SkillId | null,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.storedStolenSkillId = storedSkillId;
  applyStealCompletionTraits(context, at);
  emitThiefState(context, at, "steal");
}

export function completeSteal(context: ThiefCastContext): void {
  completeStealWithStoredSkill(context, selectedStolenSkill(context));
}

export function consumeStoredStolenSkill(context: ThiefCastContext): void {
  professionCoreState(context).storedStolenSkillId = null;
  emitThiefState(context, context.effectiveEnd, "stolen-skill-used");
}
