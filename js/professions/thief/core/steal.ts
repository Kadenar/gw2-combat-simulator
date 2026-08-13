import { professionCoreState } from "../../../platform/engine/profession.js";
import { THIEF_SKILL_IDS as ID } from "../data/ids.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { emitThiefState } from "./shared.js";
import { hasThiefTrait } from "./state.js";
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
  storeStolenSkill(context, storedSkillId, false);
  applyStealCompletionTraits(context, context.effectiveEnd);
  emitThiefState(context, context.effectiveEnd, "steal");
}

export function storeStolenSkill(
  context: ThiefCastContext,
  storedSkillId: SkillId | null,
  emitState = true,
): void {
  const state = professionCoreState(context);
  state.storedStolenSkillId = storedSkillId;
  state.storedStolenSkillCount =
    storedSkillId == null
      ? 0
      : hasThiefTrait(context.config, TRAIT.IMPROVISATION)
        ? 2
        : 1;
  if (emitState) emitThiefState(context, context.effectiveEnd, "stolen-skill");
}

export function completeSteal(context: ThiefCastContext): void {
  completeStealWithStoredSkill(context, selectedStolenSkill(context));
}

export function consumeStoredStolenSkill(context: ThiefCastContext): void {
  const state = professionCoreState(context);
  state.storedStolenSkillCount = Math.max(
    0,
    Number(state.storedStolenSkillCount || 0) - 1,
  );
  if (state.storedStolenSkillCount === 0) state.storedStolenSkillId = null;
  emitThiefState(context, context.effectiveEnd, "stolen-skill-used");
}
